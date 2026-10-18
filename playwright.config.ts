import { defineConfig } from "@playwright/test";
import { ADMIN_EMAIL, EMAIL_LOG } from "./e2e/helpers";

/**
 * Smoke tests against a production build, at the narrowest phone width we support.
 * Needs the fixture data: pnpm db:seed && pnpm db:seed:fixtures && pnpm build && pnpm test:e2e
 * Set CHROMIUM_PATH to use a preinstalled Chromium instead of `playwright install`.
 */
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  globalTeardown: "./e2e/global-teardown.ts",
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
    // Sign-in emails go to a file the tests read instead of being sent.
    env: {
      DEV_EMAIL_LOG_FILE: EMAIL_LOG,
      REVALIDATE_SECRET: "e2e-revalidate-secret",
      CRON_SECRET: "e2e-cron-secret",
      EMAIL_WEBHOOK_SECRET: "e2e-webhook-secret",
      ADMIN_EMAILS: ADMIN_EMAIL,
    },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
