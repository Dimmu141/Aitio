import { expect, test } from "./fixtures";
import { signIn, uniqueEmail } from "./helpers";

/** A show that is playing, whatever the data: the first one in the programme. */
async function openPlayingShow(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/");
  const link = page.locator("main h4 a").first();
  const title = (await link.textContent())?.trim() ?? "";
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return title;
}

test("want to see: sign in from a show, confirm, add in one tap, remove", async ({ page }) => {
  const title = await openPlayingShow(page);
  const show = page.url();
  await page.getByRole("button", { name: "Haluan nähdä" }).click();

  // Signed out: through sign-in to the list, which asks once more instead of adding on a GET.
  await signIn(page, uniqueEmail("watch"));
  await expect(page).toHaveURL(/\/haluan-nahda\?lisaa=/);
  await page.getByRole("button", { name: "Lisää listalle" }).click();
  await expect(page.getByRole("status")).toHaveText(`${title} on nyt listallasi.`);
  await expect(page.getByRole("region", { name: "Ohjelmassa" }).getByRole("link", { name: title })).toBeVisible();

  // Signed in: one tap from the show's page; adding twice keeps one row.
  await page.goto(show);
  await page.getByRole("button", { name: "Haluan nähdä" }).click();
  await expect(page).toHaveURL(/\/haluan-nahda\?lisatty=/);
  await expect(page.getByRole("link", { name: title })).toHaveCount(1);

  await page.goto("/paivakirja");
  await page.getByRole("link", { name: "Haluan nähdä (1)" }).click();
  await page.getByRole("button", { name: "Poista listalta" }).click();
  await expect(page.getByRole("status")).toHaveText("Poistettu listalta.");
  await expect(page.getByText("Listasi on tyhjä.")).toBeVisible();
});

test("the list asks you to sign in first", async ({ page }) => {
  await page.goto("/en/want-to-see");
  await expect(page).toHaveURL(/\/en\/sign-in\?next=/);
});

test("each performance downloads as a calendar file", async ({ page, request }) => {
  await openPlayingShow(page);
  const link = page.getByRole("link", { name: /^Kalenteriin: / }).first();
  const response = await request.get((await link.getAttribute("href")) ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/calendar");
  const body = await response.text();
  expect(body).toMatch(/BEGIN:VEVENT\r\n/);
  expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/);

  expect((await request.get("/api/calendar?show=nope&at=2026-01-01T00:00:00Z")).status()).toBe(404);
  expect((await request.get("/api/calendar?show=x&at=not-a-date")).status()).toBe(400);
});
