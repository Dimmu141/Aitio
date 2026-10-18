import { describe, expect, it } from "vitest";
import { nextWindow } from "./rate-limit";

const limit = { windowMs: 1000, max: 2 };

describe("nextWindow", () => {
  it("starts a window on the first attempt", () => {
    expect(nextWindow(null, 5000, limit)).toEqual({ allowed: true, state: { count: 1, windowStart: 5000 } });
  });

  it("counts up to the maximum, then refuses", () => {
    const second = nextWindow({ count: 1, windowStart: 5000 }, 5500, limit);
    expect(second).toEqual({ allowed: true, state: { count: 2, windowStart: 5000 } });
    expect(nextWindow(second.state, 5900, limit).allowed).toBe(false);
  });

  it("opens a fresh window once the old one has passed", () => {
    expect(nextWindow({ count: 2, windowStart: 5000 }, 6000, limit)).toEqual({
      allowed: true,
      state: { count: 1, windowStart: 6000 },
    });
  });
});
