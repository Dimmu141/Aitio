export const POSTER_COLOURS = ["coral", "ochre", "teal", "plum", "sage"] as const;
export type PosterColour = (typeof POSTER_COLOURS)[number];

/** FNV-1a, so the same production gets the same poster colour everywhere, forever. */
export function posterColour(slug: string): PosterColour {
  let hash = 0x811c9dc5;
  for (const char of slug) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return POSTER_COLOURS[hash % POSTER_COLOURS.length];
}
