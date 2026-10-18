import { describe, expect, it } from "vitest";
import { defaultWhen, formFields, parseEntryForm } from "./entry-form";

const asOf = new Date("2026-10-18T19:00:00Z"); // 22.00 in Helsinki
const context = {
  performances: [
    { id: "past", startsAt: new Date("2026-10-17T15:30:00Z") },
    { id: "late", startsAt: new Date("2026-10-10T21:30:00Z") }, // 00.30 on the 11th in Helsinki
    { id: "future", startsAt: new Date("2026-10-23T15:30:00Z") },
  ],
  tagSlugs: ["moving", "funny", "bold", "gripping"],
  asOf,
};

describe("parseEntryForm", () => {
  it("accepts the two-tap minimum: a performance and nothing else", () => {
    expect(parseEntryForm({ when: "perf:past" }, context)).toEqual({
      ok: true,
      value: {
        performanceId: "past",
        seenOn: "2026-10-17",
        rating: null,
        review: null,
        isPublic: false,
        isRewatch: false,
        tagSlugs: [],
      },
    });
  });

  it("takes the Helsinki day of a performance after midnight UTC", () => {
    const result = parseEntryForm({ when: "perf:late" }, context);
    expect(result.ok && result.value.seenOn).toBe("2026-10-11");
  });

  it("accepts a typed date with rating, review, tags and flags", () => {
    const result = parseEntryForm(
      { when: "date", date: "2026-10-18", rating: "7", review: "  Vahva ilta.  ", isPublic: "on", isRewatch: "on", tags: ["moving", "bold"] },
      context,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        performanceId: null,
        seenOn: "2026-10-18",
        rating: 7,
        review: "Vahva ilta.",
        isPublic: true,
        isRewatch: true,
        tagSlugs: ["moving", "bold"],
      },
    });
  });

  it.each([
    [{ when: "perf:future" }, "performance"],
    [{ when: "perf:other-production" }, "performance"],
    [{ when: "date", date: "2026-10-19" }, "date"],
    [{ when: "date", date: "1949-12-31" }, "date"],
    [{ when: "date", date: "18.10.2026" }, "date"],
    [{ when: "date", date: "2026-10-18", rating: "11" }, "rating"],
    [{ when: "date", date: "2026-10-18", rating: "3.5" }, "rating"],
    [{ when: "date", date: "2026-10-18", review: "x".repeat(501) }, "review"],
    [{ when: "date", date: "2026-10-18", tags: ["moving", "funny", "bold", "gripping"] }, "tags"],
    [{ when: "date", date: "2026-10-18", tags: "made-up" }, "tags"],
  ] as const)("rejects %o with %s", (fields, error) => {
    const result = parseEntryForm(fields, context);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain(error);
  });
});

describe("formFields", () => {
  it("keeps repeated keys as arrays", () => {
    const data = new FormData();
    data.append("tags", "moving");
    data.append("tags", "bold");
    data.append("rating", "6");
    expect(formFields(data)).toEqual({ tags: ["moving", "bold"], rating: "6" });
  });
});

describe("defaultWhen", () => {
  it("preselects last night's performance", () => {
    expect(defaultWhen(context.performances, asOf)).toBe("perf:past");
  });

  it("falls back to a date when nothing played recently", () => {
    expect(defaultWhen(context.performances, new Date("2026-10-21T12:00:00Z"))).toBe("date");
  });
});
