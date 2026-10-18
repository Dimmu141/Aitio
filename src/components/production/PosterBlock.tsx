import { isLongTitle, theatreTone } from "@/lib/poster";

/** Typographic poster: no press photos, just the title set like a printed programme cover. */
export function PosterBlock({
  theatreSlug,
  title,
  kicker,
  foot,
}: {
  theatreSlug: string;
  title: string;
  kicker: string;
  foot: string | null;
}) {
  const tone = theatreTone(theatreSlug);
  return (
    <div className={`ai-poster ai-poster--${tone.name}`}>
      <p className="ai-poster__kicker">{kicker}</p>
      <div>
        <h1 className={`ai-poster__title${isLongTitle(title) ? " ai-poster__title--long" : ""}`}>{title}</h1>
        <hr className="ai-poster__rule" />
        {foot && <p className="ai-poster__foot">{foot}</p>}
      </div>
    </div>
  );
}
