/**
 * Printed-programme card colours for the typographic poster block. Each production
 * gets a stable tone from its slug, so the same show always looks the same.
 */
export const POSTER_TONES = [
  { background: "#7A2418", text: "#FAF7F0" }, // oxblood
  { background: "#24453A", text: "#FAF7F0" }, // bottle green
  { background: "#1F3A5F", text: "#FAF7F0" }, // programme blue
  { background: "#4E2A4F", text: "#FAF7F0" }, // plum
  { background: "#3A3F44", text: "#FAF7F0" }, // graphite
  { background: "#E8C25A", text: "#1C1A17" }, // ochre
  { background: "#C9D3B8", text: "#1C1A17" }, // sage
  { background: "#E9CFC2", text: "#1C1A17" }, // blush
] as const;

export type PosterTone = (typeof POSTER_TONES)[number];

/** FNV-1a: tiny, stable across runtimes, good enough spread for eight buckets. */
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
