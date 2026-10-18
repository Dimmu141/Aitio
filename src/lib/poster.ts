/**
 * Poster grounds, each with its fixed text colour: the design system's five plus "ink
 * blue", added so each of the six theatres has its own. A production takes its
 * theatre's colour, so the stripe on a card and the poster on its page say the same
 * thing: which house it plays in.
 */
export const POSTER_TONES = [
  { name: "coral", background: "#E8735A", text: "#1F1A14" },
  { name: "ochre", background: "#D9A441", text: "#1F1A14" },
  { name: "teal", background: "#2F6B67", text: "#FFFDF8" },
  { name: "plum", background: "#5B3A5E", text: "#FFFDF8" },
  { name: "sage", background: "#A9B79A", text: "#1F1A14" },
  { name: "blue", background: "#2B4C7E", text: "#FFFDF8" },
] as const;

export type PosterTone = (typeof POSTER_TONES)[number];
type ToneName = PosterTone["name"];

/** One colour per theatre in THEATRES (src/scrapers/theatres.ts); a test keeps them distinct. */
export const THEATRE_TONES: Readonly<Record<string, ToneName>> = {
  kansallisteatteri: "plum",
  "svenska-teatern": "teal",
  "helsingin-kaupunginteatteri": "coral",
  ryhmateatteri: "ochre",
  "kom-teatteri": "sage",
  "espoon-teatteri": "blue",
};

/** FNV-1a: tiny and stable across runtimes; only for theatres added before THEATRE_TONES. */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export function theatreTone(theatreSlug: string): PosterTone {
  const name = THEATRE_TONES[theatreSlug];
  return POSTER_TONES.find((tone) => tone.name === name) ?? POSTER_TONES[hash(theatreSlug) % POSTER_TONES.length];
}

/** Titles longer than this drop to the display size so a 360px poster keeps its shape. */
export const LONG_TITLE = 18;

export function isLongTitle(title: string): boolean {
  return title.length > LONG_TITLE || title.split(/\s+/).some((word) => word.length > 11);
}
