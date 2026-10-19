import { describe, expect, it } from "vitest";
import { reviewOrder, type TypeReviewRow } from "./catalogue-admin";

const row = (title: string, over: Partial<TypeReviewRow> = {}): TypeReviewRow => ({
  id: title,
  slug: title,
  title,
  theatre: "T",
  type: "OTHER",
  typeConfidence: 0.2,
  typeOverride: null,
  next: null,
  ...over,
});

describe("reviewOrder", () => {
  it("puts what is on soon first, archived posts after, overrides last", () => {
    const rows = [
      row("Konstens natt"),
      row("Done", { typeOverride: "PLAY", next: new Date("2026-10-20") }),
      row("Next week", { next: new Date("2026-10-26"), typeConfidence: 0.5 }),
      row("Tomorrow", { next: new Date("2026-10-20"), typeConfidence: 0.5 }),
    ];
    expect(rows.sort(reviewOrder).map((r) => r.title)).toEqual(["Tomorrow", "Next week", "Konstens natt", "Done"]);
  });
});
