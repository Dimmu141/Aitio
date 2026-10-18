import { defineConfig } from "@playwright/test";

/**
 * Smoke tests against a production build, at the narrowest phone width we support.
 * Needs the fixture data: pnpm db:seed && pnpm db:seed:fixtures && pnpm build && pnpm test:e2e
 * Set CHROMIUM_PATH to use a preinstalled Chromium instead of `playwright install`.
 */
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 360, height: 800 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "js", use: { javaScriptEnabled: true } },
    { name: "no-js", use: { javaScriptEnabled: false } },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
