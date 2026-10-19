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
  { path: "/haku?q=smeds", lang: "fi" },
  { path: "/sv/sok", lang: "sv" },
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

for (const path of ["/esitys/viidakon-villit-naiset-kansallisteatteri", "/sv/teater/svenska-teatern", "/en/person/anna-maria-lipponen", "/"]) {
  test(`${path} has a share image a link preview can fetch without a redirect`, async ({ page, request }) => {
    await page.goto(path);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(/\/api\/og/);
    const response = await request.get(new URL(image ?? "").pathname + new URL(image ?? "").search, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
}

test("the front page names Aitio in its title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Aitio – teatteri, tanssi ja ooppera Helsingissä");
  await page.goto("/en");
  await expect(page).toHaveTitle("Aitio – theatre, dance and opera in Helsinki");
});

test("filters work as a plain form", async ({ page }) => {
  // Works on fixture data and on a real scrape alike: Swedish narrows the list, never to zero.
  const count = async () => Number((await page.getByRole("heading", { level: 2, name: /ohjelmassa$/ }).textContent())?.match(/\d+/)?.[0]);
  await page.goto("/");
  const all = await count();
  await page.getByText("Rajaa esityksiä").click();
  await page.getByRole("group", { name: "Esityskieli" }).getByText("ruotsi").click();
  await page.getByRole("button", { name: "Näytä esitykset" }).click();
  await expect(page).toHaveURL(/lang=sv/);
  const swedish = await count();
  expect(swedish).toBeGreaterThan(0);
  expect(swedish).toBeLessThan(all);
});

test("time chips are one-tap links that keep the other choices", async ({ page }) => {
  await page.goto("/?lang=sv");
  const chips = page.getByRole("navigation", { name: "Milloin" });
  await expect(chips.getByRole("link", { name: "2 viikkoa" })).toHaveAttribute("aria-current", "true");
  const week = chips.getByRole("link", { name: "7 päivää" });
  // A chip is only offered when something plays then; fixture dates may not cover the week.
  test.skip((await week.count()) === 0, "nothing plays within seven days in this data");
  await week.click();
  await expect(page).toHaveURL(/lang=sv&when=week/);
  await expect(chips.getByRole("link", { name: "7 päivää" })).toHaveAttribute("aria-current", "true");
});

test("search finds theatres, people and shows, accents forgiven", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Päävalikko" }).first().getByRole("link", { name: "Haku" }).click();
  await expect(page).toHaveURL(/\/haku$/);
  await page.getByLabel("Esitys, tekijä tai teatteri").fill("kansallis");
  await page.getByRole("button", { name: "Hae" }).click();
  await expect(page).toHaveURL(/\/haku\?q=kansallis/);
  await page.getByRole("region", { name: "Teatterit" }).getByRole("link", { name: /Kansallisteatteri/ }).click();
  await expect(page).toHaveURL(/\/teatteri\/kansallisteatteri$/);

  await page.goto("/en/search?q=zzzzqx");
  await expect(page.getByText("Nothing found for “zzzzqx”")).toBeVisible();
});

test("the production page has event JSON-LD and outbound ticket links", async ({ page }) => {
  await page.goto("/esitys/viidakon-villit-naiset-kansallisteatteri");
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  const events = JSON.parse(jsonLd ?? "[]") as Array<{ "@type": string }>;
  expect(events[0]["@type"]).toBe("TheaterEvent");
  await expect(page.getByRole("link", { name: /^Liput/ }).first()).toHaveAttribute("rel", /noopener/);
});

test("the about page is linked from the footer in every language", async ({ page }) => {
  await page.goto("/sv");
  await page.getByRole("contentinfo").getByRole("link", { name: "Om Aitio" }).click();
  await expect(page).toHaveURL(/\/sv\/om$/);
  await expect(page.getByRole("heading", { level: 1, name: "Om Aitio" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Kansallisteatteri/ })).toHaveAttribute("rel", /noopener/);
});

test("sitemap, robots and manifest are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/sv/forestallning/nattland-svenska-teatern");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { icons: unknown[] };
  expect(manifest.icons).toHaveLength(3);
});

test("the revalidate endpoint needs the secret and known tags", async ({ request }) => {
  const post = (secret: string, tags: string[]) =>
    request.post("/api/revalidate", { headers: { Authorization: `Bearer ${secret}` }, data: { tags, immediate: true } });
  expect((await post("wrong", ["catalogue"])).status()).toBe(401);
  expect((await post("e2e-revalidate-secret", ["../etc"])).status()).toBe(400);
  const ok = await post("e2e-revalidate-secret", ["production:nattland-svenska-teatern"]);
  expect(ok.status()).toBe(200);
});
