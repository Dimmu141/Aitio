import { posterColour, type PosterColour } from "@/lib/poster";

// Text colour is fixed per ground so posters look the same in both themes.
const GROUND: Record<PosterColour, string> = {
  coral: "bg-poster-coral text-ink-fixed",
  ochre: "bg-poster-ochre text-ink-fixed",
  teal: "bg-poster-teal text-paper-fixed",
  plum: "bg-poster-plum text-paper-fixed",
  sage: "bg-poster-sage text-ink-fixed",
};

const LONG_TITLE = 18;

type PosterProps = {
  slug: string;
  title: string;
  kicker?: string;
  byline?: string;
};

/** The typographic poster: Aitio never shows press photos. */
export function Poster({ slug, title, kicker, byline }: PosterProps) {
  const titleSize = title.length > LONG_TITLE ? "text-display" : "text-poster-title";
  return (
    <div className={`flex min-h-48 flex-col justify-between rounded-md px-4 pt-6 pb-4 ${GROUND[posterColour(slug)]}`}>
      {kicker && <p className="text-label uppercase">{kicker}</p>}
      <div>
        <h1 className={`mt-6 mb-2 font-serif hyphens-auto [overflow-wrap:anywhere] ${titleSize}`}>
          {title}
        </h1>
        <hr className="mb-2 w-16 border-t-2 border-current" />
        {byline && <p className="text-meta">{byline}</p>}
      </div>
    </div>
  );
}

/** 3:4 thumbnail for lists. Decorative: the title is repeated next to it. */
export function PosterSmall({ slug, title }: { slug: string; title: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[3/4] w-20 shrink-0 items-end overflow-hidden rounded-md p-2 sm:w-24 ${GROUND[posterColour(slug)]}`}
    >
      <span className="line-clamp-4 font-serif text-[15px] leading-[18px] font-semibold hyphens-auto [overflow-wrap:anywhere]">
        {title}
      </span>
    </div>
  );
}
