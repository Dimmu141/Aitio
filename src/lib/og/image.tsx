import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { theatreTone } from "@/lib/poster";
import { TOKENS } from "@/lib/tokens";
import { OG_SIZE } from "./size";

/** One render per day at most: the CDN keeps it, and a stale poster for a day is harmless. */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const FONT_DIR = join(process.cwd(), "src/app/fonts/og");

/** Static TTF cuts: next/og cannot read woff2, and next/font only hands out CSS. */
async function fonts() {
  const [serif, sans, sansBold] = await Promise.all(
    ["newsreader-600.ttf", "atkinson-400.ttf", "atkinson-700.ttf"].map((file) => readFile(join(FONT_DIR, file))),
  );
  return [
    { name: "Newsreader", data: serif, weight: 600 as const, style: "normal" as const },
    { name: "Atkinson", data: sans, weight: 400 as const, style: "normal" as const },
    { name: "Atkinson", data: sansBold, weight: 700 as const, style: "normal" as const },
  ];
}

/** Long titles step down so they stay on three lines at most ("Mumindalens sagostund: …" is 63). */
export function titleSize(title: string): number {
  if (title.length <= 18) return 112;
  if (title.length <= 36) return 88;
  if (title.length <= 70) return 68;
  return 56;
}

export interface Card {
  kicker: string;
  title: string;
  foot: string | null;
  /** A theatre's poster ground; without one, the paper and ink of the site. */
  theatreSlug?: string;
}

function colours(theatreSlug: string | undefined): { background: string; text: string } {
  return theatreSlug ? theatreTone(theatreSlug) : { background: TOKENS.paper, text: TOKENS.ink };
}

/** The typographic poster from the production page, at share size. No photos, ever. */
function Poster({ kicker, title, foot, theatreSlug }: Card) {
  const { background, text } = colours(theatreSlug);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background,
        color: text,
        fontFamily: "Atkinson",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {kicker}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Newsreader",
            fontWeight: 600,
            fontSize: titleSize(title),
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", width: 120, height: 4, marginTop: 28, background: text }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24 }}>
          <div style={{ display: "flex", fontSize: 34, maxWidth: 820 }}>{foot ?? ""}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>omaaitio.fi</div>
        </div>
      </div>
    </div>
  );
}

export async function cardImage(card: Card): Promise<ImageResponse> {
  return new ImageResponse(<Poster {...card} />, {
    ...OG_SIZE,
    fonts: await fonts(),
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
