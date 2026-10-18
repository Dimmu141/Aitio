import { describe, expect, it } from "vitest";
import { describeError, looksBroken, runSource } from "./run";
import type { SourceAdapter } from "./types";

describe("looksBroken", () => {
  it("flags an empty result", () => {
    expect(looksBroken(0, undefined)).toMatch(/0 productions/);
  });

  it("flags a drop of more than half", () => {
    expect(looksBroken(9, 21)).toMatch(/previous successful run found 21/);
  });

  it("accepts normal variation", () => {
    expect(looksBroken(18, 21)).toBeUndefined();
    expect(looksBroken(5, undefined)).toBeUndefined();
  });
});

describe("describeError", () => {
  it("follows the cause chain", () => {
    const error = new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND example.fi") });
    expect(describeError(error)).toBe("fetch failed: getaddrinfo ENOTFOUND example.fi");
  });

  it("handles non-errors", () => {
    expect(describeError("boom")).toBe("boom");
  });
});

describe("runSource (dry run, no database)", () => {
  const adapter: SourceAdapter = {
    id: "fake",
    fetchProductions: async () => [
      { externalId: "a", title: "Ok", url: "https://example.fi/a", isVisiting: false },
      { externalId: "b", title: "Broken", url: "https://example.fi/b", isVisiting: false },
    ],
    fetchProductionDetail: async (ref) => {
      if (ref.externalId === "b") throw new Error("HTTP 500");
      return {
        ...ref,
        languages: ["fi"],
        subtitleLangs: [],
        credits: [],
        performances: [],
        criticReviews: [],
        performancesPartial: false,
      };
    },
  };

  it("keeps going when one page fails and reports it", async () => {
    const lines: string[] = [];
    const result = await runSource(null, adapter, { dryRun: true, log: (line) => lines.push(line) });
    expect(result).toMatchObject({ found: 2, saved: 1 });
    expect(result.failed).toEqual([{ url: "https://example.fi/b", error: "HTTP 500" }]);
  });

  it("aborts when the source returns nothing", async () => {
    const empty: SourceAdapter = { ...adapter, fetchProductions: async () => [] };
    await expect(runSource(null, empty, { dryRun: true, log: () => {} })).rejects.toThrow(/0 productions/);
  });
});
