import { expect, test } from "./fixtures";
import { codeFor, magicLinkFor, uniqueEmail } from "./helpers";

async function requestCode(page: import("@playwright/test").Page, email: string): Promise<void> {
  await page.goto("/kirjaudu");
  await page.getByLabel("Sähköpostiosoite").fill(email);
  await page.getByRole("button", { name: "Lähetä kirjautumiskoodi" }).click();
  await expect(page.getByRole("heading", { name: "Tarkista sähköpostisi" })).toBeVisible();
}

test("typing the six-digit code signs in, in the same browser", async ({ page }) => {
  const email = uniqueEmail("code");
  await requestCode(page, email);
  const code = await codeFor(email);
  await page.getByLabel("Koodi sähköpostista").fill(code);
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
  await expect(page).toHaveURL(/\/paivakirja$/);
});

test("a wrong code says so and lets you try again", async ({ page }) => {
  const email = uniqueEmail("wrong");
  await requestCode(page, email);
  const code = await codeFor(email);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Koodi sähköpostista").fill(wrong);
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
  await expect(page.getByText("Koodi ei kelpaa.")).toBeVisible();
  await page.getByLabel("Koodi sähköpostista").fill(code);
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
  await expect(page).toHaveURL(/\/paivakirja$/);
});

test("the emailed link hides the address and code, and a tampered one fails", async ({ page }) => {
  const email = uniqueEmail("link");
  await requestCode(page, email);
  const link = await magicLinkFor(email);
  expect(link).not.toContain(encodeURIComponent(email));
  expect(link).not.toContain(await codeFor(email));
  const tampered = new URL(link);
  tampered.searchParams.set("token", `${tampered.searchParams.get("token")?.slice(0, -4)}AAAA`);
  await page.goto(tampered.toString());
  await page.getByRole("button", { name: "Kirjaudu sisään" }).click();
  await expect(page.getByText("Linkki on vanhentunut tai jo käytetty.")).toBeVisible();
});
