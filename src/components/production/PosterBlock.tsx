import { posterTone } from "@/lib/poster";

/** Typographic poster: no press photos, just the title set like a printed programme cover. */
export function PosterBlock({
  slug,
  title,
  theatre,
  stage,
  kicker,
}: {
  slug: string;
  title: string;
  theatre: string;
  stage: string | null;
  kicker: string;
}) {
  const tone = posterTone(slug);
  return (
    <div
      className="flex min-h-56 flex-col justify-between rounded-sm px-5 py-6 shadow-[inset_0_0_0_6px_rgb(0_0_0/0.06)] sm:px-8 sm:py-8"
      style={{ backgroundColor: tone.background, color: tone.text }}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em]">{theatre}</p>
      <h1 className="my-6 font-serif text-4xl font-semibold break-words hyphens-auto sm:text-5xl">{title}</h1>
      <p className="flex flex-wrap justify-between gap-x-4 border-t border-current pt-3 text-base">
        <span>{kicker}</span>
        {stage && <span>{stage}</span>}
      </p>
    </div>
  );
}
