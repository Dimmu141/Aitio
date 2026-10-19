import { describe, expect, it } from "vitest";
import { openDraft, sealDraft } from "./draft";
import { MAX_REVIEW_LENGTH, type EntryInput } from "./entry-form";

const secret = "test-secret-test-secret-test-secret";
const entry: EntryInput = {
  performanceId: null,
  seenOn: "2026-10-18",
  rating: 9,
  review: "Hieno ilta.",
  isPublic: true,
  isRewatch: false,
  tagSlugs: ["moving"],
};

describe("log draft", () => {
  it("comes back for the same show only", () => {
    const token = sealDraft("kärpäset", entry, secret);
    expect(openDraft(token, "kärpäset", secret)).toEqual(entry);
    expect(openDraft(token, "nattland", secret)).toBeNull();
    expect(openDraft(undefined, "kärpäset", secret)).toBeNull();
  });

  it("cannot be replayed as a sign-in link or forged", () => {
    expect(openDraft("x".repeat(80), "kärpäset", secret)).toBeNull();
    expect(openDraft(sealDraft("kärpäset", entry, secret), "kärpäset", "another-secret-another")).toBeNull();
  });

  it("fits in a cookie even with the longest review", () => {
    const longest = { ...entry, review: "ä".repeat(MAX_REVIEW_LENGTH), tagSlugs: ["moving", "bold", "funny"] };
    expect(sealDraft("a-very-long-production-slug-kansallisteatteri", longest, secret).length).toBeLessThan(3800);
  });
});
