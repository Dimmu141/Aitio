import { expect, test } from "./fixtures";

test("the privacy policy is linked from every page, in every language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Tietosuoja" }).click();
  await expect(page).toHaveURL(/\/tietosuoja$/);
  await expect(page.getByRole("heading", { name: "Tietosuojaseloste", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Esitysten tekijät" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.goto("/sv/dataskydd");
  await expect(page.getByRole("heading", { name: "Dataskyddsbeskrivning", level: 1 })).toBeVisible();
  await page.goto("/en/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();

  await page.goto("/kirjaudu");
  await expect(page.getByRole("main").getByRole("link", { name: "Tietosuojaseloste" })).toBeVisible();
});

test("responses carry the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the cleanup cron and the email webhook need their secrets", async ({ request }) => {
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
  const cleanup = await request.get("/api/cron/cleanup", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(Object.keys(await cleanup.json()).sort()).toEqual(["overdue", "rateLimits", "sessions", "verifications"]);

  const event = { event: "hard_bounce", email: "nobody-e2e@example.fi" };
  expect((await request.post("/api/email/events", { data: event })).status()).toBe(401);
  const hook = await request.post("/api/email/events", { data: event, headers: { Authorization: "Bearer e2e-webhook-secret" } });
  expect(await hook.json()).toEqual({ stopped: 0 });
});
