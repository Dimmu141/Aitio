import "dotenv/config";
import { Client } from "pg";
import { unsubscribeSignature } from "../src/lib/engagement/unsubscribe";
import { expect, test } from "./fixtures";
import { signIn, uniqueEmail } from "./helpers";

async function userId(email: string): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [email]);
    if (!rows[0]) throw new Error(`No user ${email}`);
    return rows[0].id;
  } finally {
    await client.end();
  }
}

test("the diary shows badges and links to the year in review", async ({ page }) => {
  await page.goto("/merkitse/nattland-svenska-teatern");
  await signIn(page, uniqueEmail("year"));
  await page.getByRole("radio", { name: "4 / 5 tähteä" }).check({ force: true });
  await page.getByRole("button", { name: "Tallenna" }).click();
  await page.goto("/merkitse/viidakon-villit-naiset-kansallisteatteri");
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("status")).toHaveText("Tallennettu päiväkirjaan.");

  const badges = page.getByRole("region", { name: /Saavutukset/ });
  await expect(badges.getByText("Ensimmäinen näytös")).toBeVisible();
  await expect(badges.getByText("Kaksikielinen")).toBeVisible();
  await expect(badges.getByText(/Vielä ansaitsematta/)).toBeVisible();

  const year = new Date().getFullYear();
  await page.getByRole("link", { name: `Vuoden ${year} kooste` }).click();
  await expect(page.getByRole("heading", { name: `Vuosi ${year} teatterissa` })).toBeVisible();
  await expect(page.getByText("esitystä", { exact: true })).toBeVisible();
  await expect(page.getByText("2 eri produktiota")).toBeVisible();
  await expect(page.getByRole("link", { name: "Kansallisteatteri" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Parhaat arviosi" }).getByRole("link", { name: "Nattland" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.goto(`/en/diary/${year}`);
  await expect(page.getByRole("heading", { name: `Your ${year} at the theatre` })).toBeVisible();
  await page.goto("/paivakirja/2001");
  await expect(page.getByText("Et merkinnyt vuonna 2001 yhtään esitystä.")).toBeVisible();
});

test("opt in to the digest in settings and unsubscribe from the email link", async ({ page, request }) => {
  const email = uniqueEmail("digest");
  await page.goto("/asetukset");
  await signIn(page, email);
  const optIn = page.getByLabel("Haluan viestin torstaisin");
  await expect(optIn).not.toBeChecked();
  await optIn.check();
  await page.getByRole("button", { name: "Tallenna valinta" }).click();
  await expect(page.getByRole("status")).toHaveText("Tallennettu.");
  await expect(page.getByLabel("Haluan viestin torstaisin")).toBeChecked();

  const id = await userId(email);
  const query = new URLSearchParams({ u: id, s: unsubscribeSignature(id) }).toString();
  await page.goto(`/peru-tilaus?u=${id}&s=forged`);
  await page.getByRole("button", { name: "Peru tilaus" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Linkki ei kelpaa" })).toBeVisible();

  await page.goto(`/peru-tilaus?${query}`);
  await page.getByRole("button", { name: "Peru tilaus" }).click();
  await expect(page.getByRole("status")).toHaveText("Tilaus peruttu. Voit tilata viestin uudelleen asetuksista.");
  await page.goto("/asetukset");
  await expect(page.getByLabel("Haluan viestin torstaisin")).not.toBeChecked();

  // Mail clients' one-click unsubscribe (RFC 8058) posts straight to the API.
  expect((await request.post(`/api/digest/unsubscribe?u=${id}&s=forged`)).status()).toBe(400);
  expect((await request.post(`/api/digest/unsubscribe?${query}`)).status()).toBe(200);
});

test("the digest cron needs the secret", async ({ request }) => {
  expect((await request.get("/api/cron/digest")).status()).toBe(401);
  const run = await request.get("/api/cron/digest", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(run.status()).toBe(200);
  expect(Object.keys(await run.json()).sort()).toEqual(["due", "empty", "failed", "sent"]);
});
