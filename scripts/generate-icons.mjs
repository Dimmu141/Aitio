// Render the app icons (oxblood square, Source Serif "A") to public/icons with Playwright.
// Re-run after changing the design: node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ACCENT = "#7A2418";
const PAPER = "#FAF7F0";
const ICONS = [
  { file: "icon-192.png", size: 192, padding: 0.12, radius: 0.18 },
  { file: "icon-512.png", size: 512, padding: 0.12, radius: 0.18 },
  // Maskable: full-bleed background, glyph inside the 80 % safe zone.
  { file: "icon-maskable-512.png", size: 512, padding: 0.24, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.12, radius: 0 },
  { file: "favicon-32.png", size: 32, padding: 0.04, radius: 0.15 },
];

function html({ size, padding, radius }) {
  const glyph = Math.round(size * (1 - 2 * padding) * 0.95);
  return `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@60,600&display=block">
<style>html,body{margin:0;background:transparent}
div{width:${size}px;height:${size}px;background:${ACCENT};border-radius:${radius * size}px;display:flex;align-items:center;justify-content:center;
color:${PAPER};font-family:'Source Serif 4',Georgia,serif;font-weight:600;font-size:${glyph}px;line-height:1}
span{transform:translateY(-4%)}</style></head><body><div><span>A</span></div></body></html>`;
}

const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
await mkdir("public/icons", { recursive: true });
for (const icon of ICONS) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
  await page.setContent(html(icon), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("div").screenshot({ path: `public/icons/${icon.file}`, omitBackground: true });
  console.log(`public/icons/${icon.file}`);
  await page.close();
}
await browser.close();
