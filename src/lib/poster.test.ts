import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { POSTER_TONES, THEATRE_TONES, theatreTone } from "./poster";
import { THEATRES } from "@/scrapers/theatres";
import { TOKENS } from "./tokens";

describe("theatreTone", () => {
  it("gives every theatre its own colour", () => {
    const tones = THEATRES.map((theatre) => theatreTone(theatre.slug).name);
    expect(new Set(tones).size).toBe(THEATRES.length);
  });

  it("has an entry for every theatre, so none falls back to the hash", () => {
    expect(THEATRES.map((theatre) => theatre.slug).filter((slug) => !(slug in THEATRE_TONES))).toEqual([]);
  });

  it("is stable for a theatre it doesn't know yet", () => {
    expect(theatreTone("uusi-teatteri")).toBe(theatreTone("uusi-teatteri"));
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
