import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { POSTER_TONES, posterTone } from "./poster";
import { TOKENS } from "./tokens";

describe("posterTone", () => {
  it("is stable for a slug", () => {
    expect(posterTone("nattland-svenska-teatern")).toBe(posterTone("nattland-svenska-teatern"));
  });

  it("spreads slugs over all five grounds", () => {
    const used = new Set(Array.from({ length: 40 }, (_, index) => posterTone(`show-${index}`)));
    expect(used.size).toBe(POSTER_TONES.length);
  });

  // The poster title is large text, but its foot line is 16px, so every ground meets AA for body text.
  it.each(POSTER_TONES.map((tone) => [tone.name, tone]))("%s meets WCAG AA", (_, tone) => {
    expect(contrastRatio(tone.text, tone.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("design tokens", () => {
  it.each([
    ["ink on paper", TOKENS.ink, TOKENS.paper, 7],
    ["muted ink on paper", TOKENS.inkMuted, TOKENS.paper, 6.5],
    ["muted ink on sunk paper", TOKENS.inkMuted, TOKENS.paperSunk, 5.5],
    ["accent text on paper", TOKENS.accent, TOKENS.paper, 4.5],
    ["accent text on raised paper", TOKENS.accent, TOKENS.paperRaised, 4.5],
    ["button text on accent", TOKENS.onAccent, TOKENS.accent, 4.5],
    ["button text on hover", TOKENS.onAccent, TOKENS.accentStrong, 7],
    ["ink on accent tint", TOKENS.ink, TOKENS.accentTint, 7],
    ["ink on urgent", TOKENS.inkFixed, TOKENS.urgent, 7],
    ["strong rule on paper (non-text)", TOKENS.ruleStrong, TOKENS.paper, 3],
    ["focus ring on paper (non-text)", TOKENS.focus, TOKENS.paper, 3],
    ["success on paper", TOKENS.success, TOKENS.paper, 4.5],
  ])("%s", (_, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});
