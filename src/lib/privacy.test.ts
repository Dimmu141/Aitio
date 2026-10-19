import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { SIGN_IN_MINUTES, SESSION_DAYS } from "./auth-config";
import { RATE_LIMIT_RETENTION_DAYS } from "./ops/cleanup";
import { privacyPolicy } from "./privacy";

const config = { controller: "Aitio / Dimmu", email: "tietosuoja@aitio.fi" };
const text = (locale: (typeof LOCALES)[number]) => JSON.stringify(privacyPolicy(locale, config, "18.10.2026"));

describe("privacyPolicy", () => {
  it("has the same sections in every language", () => {
    const counts = LOCALES.map((locale) => privacyPolicy(locale, config, "x").sections.length);
    expect(new Set(counts).size).toBe(1);
  });

  it.each(LOCALES)("names the controller and quotes the real retention numbers (%s)", (locale) => {
    const policy = text(locale);
    expect(policy).toContain(config.controller);
    expect(policy).toContain(config.email);
    for (const value of [SESSION_DAYS, SIGN_IN_MINUTES, RATE_LIMIT_RETENTION_DAYS]) expect(policy).toContain(String(value));
    expect(policy).toContain("Brevo");
    expect(policy).toContain("tietosuoja.fi");
  });
});
