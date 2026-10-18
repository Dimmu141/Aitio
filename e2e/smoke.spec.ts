import { expect, type Page, test } from "@playwright/test";

const PAGES = [
  { path: "/", lang: "fi" },
  { path: "/sv", lang: "sv" },
  { path: "/en", lang: "en" },
  { path: "/esitys/viidakon-villit-naiset-kansallisteatteri", lang: "fi" },
  { path: "/sv/forestallning/nattland-svenska-teatern", lang: "sv" },
  { path: "/en/show/nattland-svenska-teatern", lang: "en" },
  { path: "/teatteri/kansallisteatteri", lang: "fi" },
  { path: "/teatteri/helsingin-kaupunginteatteri", lang: "fi" },
  { path: "/sv/teater/svenska-teatern", lang: "sv" },
  { path: "/henkilo/kristian-smeds", lang: "fi" },
  { path: "/en/person/anna-maria-lipponen", lang: "en" },
];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const { path, lang } of PAGES) {
  test(`${path} renders at 360px`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

for (const path of ["/esitys/ei-ole", "/sv/forestallning/ei-ole", "/teatteri/ei-ole", "/en/person/ei-ole"]) {
  test(`${path} is a real 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}

test("Finnish segments under another locale redirect to the translated URL", async ({ page }) => {
  await page.goto("/sv/esitys/nattland-svenska-teatern");
  expect(new URL(page.url()).pathname).toBe("/sv/forestallning/nattland-svenska-teatern");
  await page.goto("/fi/esitys/nattland-svenska-teatern");
  expect(new URL(page.url()).pathname).toBe("/esitys/nattland-svenska-teatern");
});

test("the language switcher keeps the page, or falls back to the front page without JS", async ({
  page,
  javaScriptEnabled,
}) => {
  await page.goto("/esitys/nattland-svenska-teatern");
  const english = page.getByRole("link", { name: "English" });
  const target = javaScriptEnabled ? "/en/show/nattland-svenska-teatern" : "/en";
  await expect(english).toHaveAttribute("href", target);
  await english.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
});

test("filters work as a plain form", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Rajaa esityksiä").click();
  await page.getByRole("group", { name: "Esityskieli" }).getByText("ruotsi").click();
  await page.getByRole("button", { name: "Näytä esitykset" }).click();
  await expect(page).toHaveURL(/lang=sv/);
  await expect(page.getByRole("heading", { level: 2, name: "1 esitys ohjelmassa" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nattland" })).toBeVisible();
});

test("the production page has event JSON-LD and outbound ticket links", async ({ page }) => {
  await page.goto("/esitys/viidakon-villit-naiset-kansallisteatteri");
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  const events = JSON.parse(jsonLd ?? "[]") as Array<{ "@type": string }>;
  expect(events[0]["@type"]).toBe("TheaterEvent");
  await expect(page.getByRole("link", { name: /Osta liput/ })).toHaveAttribute("rel", /noopener/);
});

test("sitemap, robots and manifest are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/sv/forestallning/nattland-svenska-teatern");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { icons: unknown[] };
  expect(manifest.icons).toHaveLength(3);
});
