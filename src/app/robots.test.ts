import { describe, expect, it } from "vitest";
import robots, { disallowedPaths } from "./robots";

describe("robots", () => {
  it("shuts out training crawlers and keeps the rest", () => {
    const [training, everyone] = [robots().rules].flat();
    expect(training?.userAgent).toContain("meta-externalagent");
    expect(training?.userAgent).toContain("ClaudeBot");
    expect(training?.userAgent).not.toContain("OAI-SearchBot");
    expect(everyone?.userAgent).toBe("*");
    expect(everyone?.allow).toBe("/api/og/");
  });
  it("keeps crawlers off per-request pages in every language", () => {
    const paths = disallowedPaths();
    expect(paths).toEqual(expect.arrayContaining(["/api/", "/*?", "/kirjaudu$", "/sv/logga-in/", "/en/log/"]));
    expect(paths).not.toContain("/esitys/");
  });
});
