import { expect, test } from "./fixtures";
import { randomIp, signIn, signInFromLog, uniqueEmail } from "./helpers";

const PRODUCTION = "/esitys/nattland-svenska-teatern";

test("sign in, mark as seen with a review, see it in the diary and on the production page", async ({ page }) => {
  await page.goto(PRODUCTION);
  await page.getByRole("link", { name: "Merkitse nähdyksi" }).click();

  // Not signed in: fill it in first; the entry waits as a draft while we sign in.
  await expect(page.getByText("Voit täyttää merkinnän jo nyt.")).toBeVisible();
  await page.getByRole("radio", { name: "4 / 5 tähteä" }).check({ force: true });
  await signInFromLog(page, uniqueEmail("log"));
  await expect(page).toHaveURL(/\/merkitse\/nattland-svenska-teatern\?draft=1$/);
  await expect(page.getByRole("heading", { name: "Nattland" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "4 / 5 tähteä" })).toBeChecked();

  await page.getByText("Lisää arvio ja tunnisteet").click();
  const review = `Vahva ilta ${Date.now()}`;
  await page.getByLabel("Lyhyt arvio").fill(review);
  await page.getByText("Koskettava").click();
  await page.getByRole("button", { name: "Tallenna" }).click();

  await expect(page).toHaveURL(/\/paivakirja\?saved=/);
  await expect(page.getByRole("status")).toHaveText("Tallennettu päiväkirjaan.");
  const stub = page.getByRole("listitem").filter({ hasText: review });
  await expect(stub.getByRole("link", { name: "Nattland" })).toBeVisible();
  await expect(stub.getByText("Koskettava")).toBeVisible();

  await page.goto(PRODUCTION);
  const published = page.getByRole("listitem").filter({ hasText: review });
  await expect(published).toBeVisible();
  await expect(published.getByText("Katsoja")).toBeVisible();
});

test("the two-tap path: mark as seen and save with the defaults", async ({ page }) => {
  await page.goto("/merkitse/viidakon-villit-naiset-kansallisteatteri");
  await signInFromLog(page, uniqueEmail("twotap"));
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("status")).toHaveText("Tallennettu päiväkirjaan.");
  await expect(page.getByRole("link", { name: "Viidakon villit naiset" })).toBeVisible();
});

test("a future date is refused", async ({ page }) => {
  // Checked before anything is kept: no sign-in needed to see it.
  await page.goto("/merkitse/nattland-svenska-teatern");
  await page.getByLabel("Päivämäärä").evaluate((input: HTMLInputElement) => {
    input.removeAttribute("max");
    input.value = "2099-01-01";
  });
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "tulevaisuudessa" })).toBeVisible();
});

test("other people can report a review, but not their own", async ({ browser }) => {
  const visitor = () => browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  const author = await (await visitor()).newPage();
  await author.goto("/merkitse/nattland-svenska-teatern");
  await signInFromLog(author, uniqueEmail("author"));
  await author.getByText("Lisää arvio ja tunnisteet").click();
  const review = `Raportoitava ${Date.now()}`;
  await author.getByLabel("Lyhyt arvio").fill(review);
  await author.getByRole("button", { name: "Tallenna" }).click();
  await expect(author.getByRole("status")).toHaveText("Tallennettu päiväkirjaan.");

  await author.goto(PRODUCTION);
  const reportLink = author.getByRole("listitem").filter({ hasText: review }).getByRole("link", { name: "Ilmoita" });
  const reportPath = new URL((await reportLink.getAttribute("href")) ?? "", "http://x").pathname;
  await author.goto(reportPath);
  await expect(author.getByRole("status")).toHaveText("Tämä on oma arviosi.");

  const reader = await (await visitor()).newPage();
  await reader.goto(reportPath);
  await signIn(reader, uniqueEmail("reader"));
  await reader.getByText("Paljastaa juonen").click();
  await reader.getByRole("button", { name: "Lähetä ilmoitus" }).click();
  await expect(reader.getByRole("status")).toHaveText("Kiitos ilmoituksesta. Arvio tarkistetaan.");
});

test("settings: the name shows on reviews, and the account can be deleted", async ({ page }) => {
  await page.goto("/asetukset");
  await signIn(page, uniqueEmail("settings"));
  await expect(page).toHaveURL(/\/asetukset$/);
  const name = `Testikatsoja ${Date.now() % 100000}`;
  await page.getByLabel("Nimi").fill(name);
  await page.getByRole("button", { name: "Tallenna nimi" }).click();
  await expect(page.getByRole("status")).toHaveText("Tallennettu.");

  await page.goto("/merkitse/nattland-svenska-teatern");
  await page.getByText("Lisää arvio ja tunnisteet").click();
  await page.getByLabel("Lyhyt arvio").fill(`Nimellä ${name}`);
  await page.getByRole("button", { name: "Tallenna" }).click();
  await expect(page.getByRole("status")).toHaveText("Tallennettu päiväkirjaan.");
  await page.goto(PRODUCTION);
  await expect(page.getByRole("listitem").filter({ hasText: `Nimellä ${name}` }).getByText(name, { exact: true })).toBeVisible();

  await page.goto("/asetukset");
  await page.getByLabel("Ymmärrän, ettei poistoa voi perua").check();
  await page.getByRole("button", { name: "Poista tili pysyvästi" }).click();
  await expect(page).toHaveURL(/\/\?accountDeleted=1$/);
  await page.goto(PRODUCTION);
  await expect(page.getByText(`Nimellä ${name}`)).toHaveCount(0);
  await page.goto("/paivakirja");
  await expect(page).toHaveURL(/\/kirjaudu\?next=/);
});

test("personal pages ask you to sign in first", async ({ page }) => {
  for (const path of ["/paivakirja", "/asetukset", "/sv/dagbok"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(kirjaudu|logga-in)\?next=/);
  }
});
