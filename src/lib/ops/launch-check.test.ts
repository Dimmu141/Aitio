import { describe, expect, it } from "vitest";
import { checkLaunchEnv } from "./launch-check";

const ready = {
  SCRAPER_USER_AGENT: "AitioBot/1.0 (+https://aitio.fi/bot; tietosuoja@aitio.fi)",
  DATABASE_URL: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/aitio?sslmode=require",
  SITE_URL: "https://aitio.fi",
  BETTER_AUTH_SECRET: "x".repeat(44),
  CRON_SECRET: "c".repeat(32),
  REVALIDATE_SECRET: "r".repeat(32),
  BREVO_API_KEY: "xkeysib-123",
  EMAIL_FROM: "Aitio <kirjaudu@aitio.fi>",
  EMAIL_WEBHOOK_SECRET: "w".repeat(32),
  ADMIN_EMAILS: "dimmu@example.fi",
  PRIVACY_CONTROLLER: "Aitio / Dimmu",
  PRIVACY_EMAIL: "tietosuoja@aitio.fi",
};

const variables = (env: Record<string, string | undefined>, level: "error" | "warning") =>
  checkLaunchEnv(env)
    .filter((finding) => finding.level === level)
    .map((finding) => finding.variable);

describe("checkLaunchEnv", () => {
  it("passes a complete production environment", () => {
    expect(checkLaunchEnv(ready)).toEqual([]);
  });

  it("flags everything missing in an empty environment", () => {
    expect(variables({}, "error")).toEqual(
      expect.arrayContaining(["SCRAPER_USER_AGENT", "DATABASE_URL", "SITE_URL", "BETTER_AUTH_SECRET", "CRON_SECRET", "BREVO_API_KEY", "PRIVACY_CONTROLLER", "PRIVACY_EMAIL"]),
    );
  });

  it("refuses local addresses, short secrets and the dev email log", () => {
    const env = { ...ready, DATABASE_URL: "postgresql://localhost/aitio", SITE_URL: "http://localhost:3000", CRON_SECRET: "short", DEV_EMAIL_LOG_FILE: "/tmp/x" };
    expect(variables(env, "error")).toEqual(["DATABASE_URL", "SITE_URL", "CRON_SECRET", "DEV_EMAIL_LOG_FILE"]);
  });

  it("catches an auth URL that disagrees with the site", () => {
    expect(variables({ ...ready, BETTER_AUTH_URL: "https://aitio.vercel.app" }, "error")).toEqual(["BETTER_AUTH_URL"]);
    expect(checkLaunchEnv({ ...ready, BETTER_AUTH_URL: "https://aitio.fi" })).toEqual([]);
  });

  it("warns about softer choices", () => {
    const env = { ...ready, BREVO_API_KEY: undefined, EMAIL_WEBHOOK_SECRET: undefined, RESEND_API_KEY: "re_1", EMAIL_FROM: "Aitio <noreply@gmail.com>", DATABASE_URL: "postgresql://u:p@db.example.com/aitio" };
    expect(variables(env, "warning")).toEqual(["DATABASE_URL", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_WEBHOOK_SECRET"]);
  });

  it("wants a real contact in the scraper's User-Agent", () => {
    expect(variables({ ...ready, SCRAPER_USER_AGENT: "AitioBot/0.1 (+https://example.fi/bot; you@example.fi)" }, "error")).toEqual([
      "SCRAPER_USER_AGENT",
    ]);
  });

  it("builds the User-Agent from the site's contact address when none is set", () => {
    expect(checkLaunchEnv({ ...ready, SCRAPER_USER_AGENT: undefined })).toEqual([]);
    expect(variables({ ...ready, SCRAPER_USER_AGENT: "AitioBot/1.0 (+https://aitio.fi/bot; muu@aitio.fi)" }, "warning")).toEqual([
      "SCRAPER_USER_AGENT",
    ]);
  });

  it("checks admin addresses", () => {
    expect(variables({ ...ready, ADMIN_EMAILS: "dimmu@example.fi, nope" }, "error")).toEqual(["ADMIN_EMAILS"]);
  });
});
