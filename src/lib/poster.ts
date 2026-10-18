/**
 * The design system's five poster grounds, each with its fixed text colour. Each
 * production gets a stable ground from its slug, so the same show always looks the same.
 */
export const POSTER_TONES = [
  { name: "coral", background: "#E8735A", text: "#1F1A14" },
  { name: "ochre", background: "#D9A441", text: "#1F1A14" },
  { name: "teal", background: "#2F6B67", text: "#FFFDF8" },
  { name: "plum", background: "#5B3A5E", text: "#FFFDF8" },
  { name: "sage", background: "#A9B79A", text: "#1F1A14" },
] as const;

export type PosterTone = (typeof POSTER_TONES)[number];

/** FNV-1a: tiny, stable across runtimes, good enough spread for five buckets. */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export function posterTone(slug: string): PosterTone {
  return POSTER_TONES[hash(slug) % POSTER_TONES.length];
}

/** Titles longer than this drop to the display size so a 360px poster keeps its shape. */
export const LONG_TITLE = 18;

export function isLongTitle(title: string): boolean {
  return title.length > LONG_TITLE || title.split(/\s+/).some((word) => word.length > 11);
}
