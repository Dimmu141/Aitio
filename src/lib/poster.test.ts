import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { POSTER_TONES, posterTone } from "./poster";
import { TOKENS } from "./tokens";

describe("posterTone", () => {
  it("is stable for a slug", () => {
    expect(posterTone("nattland-svenska-teatern")).toBe(posterTone("nattland-svenska-teatern"));
  });

  it("spreads slugs over several tones", () => {
    const used = new Set(Array.from({ length: 40 }, (_, index) => posterTone(`show-${index}`)));
    expect(used.size).toBeGreaterThanOrEqual(6);
  });

  it.each(POSTER_TONES.map((tone) => [tone.background, tone]))("%s meets WCAG AAA", (_, tone) => {
    expect(contrastRatio(tone.text, tone.background)).toBeGreaterThanOrEqual(7);
  });
});

describe("design tokens", () => {
  it.each([
    ["ink on paper", TOKENS.ink, TOKENS.paper, 7],
    ["muted ink on paper", TOKENS.inkMuted, TOKENS.paper, 7],
    ["accent on paper", TOKENS.accent, TOKENS.paper, 7],
    ["paper on accent", TOKENS.paper, TOKENS.accent, 7],
    ["ink on card", TOKENS.ink, TOKENS.card, 7],
    ["muted ink on card", TOKENS.inkMuted, TOKENS.card, 4.5],
  ])("%s", (_, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});
