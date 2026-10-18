import { describe, expect, it } from "vitest";
import { entry } from "./test-facts";
import { yearInReview } from "./year";

const kt = { slug: "kansallisteatteri", name: "Kansallisteatteri" };
const st = { slug: "svenska-teatern", name: "Svenska Teatern" };
const anna = { slug: "anna", name: "Anna" };
const ben = { slug: "ben", name: "Ben" };

describe("yearInReview", () => {
  const entries = [
    entry("2025-12-31", { production: { slug: "old" } }),
    entry("2026-01-10", { rating: 8, tags: ["moving"], production: { slug: "a", theatre: kt, cast: [anna, ben] } }),
    entry("2026-01-20", { rating: 10, hasReview: true, tags: ["moving", "funny"], production: { slug: "b", theatre: st, languages: ["sv"], cast: [anna] } }),
    entry("2026-03-05", { rating: 6, production: { slug: "a", theatre: kt, cast: [anna, ben] } }),
    entry("2026-03-06", { production: { slug: "c", theatre: kt, type: "MUSICAL" } }),
  ];
  const review = yearInReview(entries, 2026);

  it("counts only the year's entries", () => {
    expect(review.shows).toBe(4);
    expect(review.productions).toBe(3);
    expect(review.first?.slug).toBe("a");
    expect(review.last?.slug).toBe("c");
  });

  it("counts a second visit to the same production as a rewatch", () => {
    expect(review.rewatches).toBe(1);
  });

  it("counts a rewatch of something first seen the year before", () => {
    const repeat = yearInReview([entry("2025-05-01", { production: { slug: "x" } }), entry("2026-02-01", { production: { slug: "x" } })], 2026);
    expect(repeat.rewatches).toBe(1);
  });

  it("buckets by month and finds the busiest", () => {
    expect(review.months).toEqual([2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(review.busiestMonth).toBe(0);
  });

  it("ranks theatres, tags and types by count", () => {
    expect(review.theatres).toEqual([
      { item: kt, count: 3 },
      { item: st, count: 1 },
    ]);
    expect(review.tags[0]).toEqual({ item: "moving", count: 2 });
    expect(review.types.map((type) => type.item)).toEqual(["PLAY", "MUSICAL"]);
    expect(review.languages).toEqual(["fi", "sv"]);
  });

  it("averages ratings in stars and keeps one favourite per production", () => {
    expect(review.averageRating).toBe(4);
    expect(review.rated).toBe(3);
    expect(review.favourites.map((favourite) => [favourite.slug, favourite.rating])).toEqual([
      ["b", 10],
      ["a", 8],
    ]);
  });

  it("lists performers seen in two productions, once per production", () => {
    expect(review.performers).toEqual([{ item: anna, count: 2 }]);
  });

  it("is empty for a year without entries", () => {
    const empty = yearInReview(entries, 2024);
    expect(empty.shows).toBe(0);
    expect(empty.busiestMonth).toBeNull();
    expect(empty.averageRating).toBeNull();
    expect(empty.first).toBeNull();
  });
});
