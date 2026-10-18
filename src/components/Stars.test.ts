import { describe, expect, it } from "vitest";
import { starText } from "./Stars";

describe("starText", () => {
  it.each([
    [1, "½"],
    [2, "★"],
    [7, "★★★½"],
    [10, "★★★★★"],
  ])("%i half-stars → %s", (halfStars, expected) => {
    expect(starText(halfStars)).toBe(expected);
  });
});
