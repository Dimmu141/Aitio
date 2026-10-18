import { expect, test } from "./fixtures";
import { ADMIN_EMAIL, signIn, uniqueEmail } from "./helpers";

test("the cron route needs the secret and a known source", async ({ request }) => {
  expect((await request.get("/api/cron/scrape/hkt")).status()).toBe(401);
  expect((await request.get("/api/cron/scrape/hkt", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const unknown = await request.get("/api/cron/scrape/nowhere", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toMatchObject({ skipped: "unknown source" });
});

test("the admin page shows ordinary users nothing but 'not found'", async ({ page }) => {
  await page.goto("/yllapito");
  await signIn(page, uniqueEmail("not-admin"));
  // The status stays 200 (the layout is flushed before the page decides), so check what
  // matters: none of the admin content is in the response at all.
  const response = await page.goto("/yllapito");
  const html = (await response?.text()) ?? "";
  for (const secret of ["Lajityypit", "Ilmoitukset", "Aiemmat ajot", "Haut"]) expect(html).not.toContain(secret);
  await expect(page.getByRole("heading", { name: "Haut" })).toHaveCount(0);
});

test("admins see scrape health, type review and moderation", async ({ page }) => {
  await page.goto("/yllapito");
  await signIn(page, ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/yllapito$/);
  await expect(page.getByRole("heading", { name: "Haut" })).toBeVisible();
  for (const theatre of ["Kansallisteatteri", "Helsingin Kaupunginteatteri", "Espoon Teatteri", "KOM-teatteri"]) {
    await expect(page.getByText(theatre, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Lajityypit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ilmoitukset" })).toBeVisible();
});
