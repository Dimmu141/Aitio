import { describe, expect, it } from "vitest";
import { userAgent } from "./agent";

describe("userAgent", () => {
  it("names the about page and the contact address the site shows", () => {
    expect(userAgent({ SITE_URL: "https://omaaitio.fi", PRIVACY_EMAIL: "palaute@omaaitio.fi" })).toBe(
      "AitioBot/1.0 (+https://omaaitio.fi/tietoa; palaute@omaaitio.fi)",
    );
  });

  it("lets an explicit SCRAPER_USER_AGENT win", () => {
    expect(userAgent({ SCRAPER_USER_AGENT: "AitioBot/2.0 (+https://x.fi)", PRIVACY_EMAIL: "a@b.fi" })).toBe("AitioBot/2.0 (+https://x.fi)");
  });
});
