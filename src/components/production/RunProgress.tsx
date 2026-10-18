import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { formatPerformance, formatShortDate, isoDateTime } from "@/lib/format";

/**
 * Where the run stands: how many performances are left, and a bar from the premiere to
 * the end. Counting needs the theatre's whole schedule; without it we say what's next.
 */
export function RunProgress({
  progress,
  premiere,
  end,
  next,
  remaining,
  fullSchedule,
  asOf,
  locale,
  t,
}: {
  progress: number | null;
  premiere: Date | null;
  /** The known end of the run (`knownEnd`), not merely the last listed date. */
  end: Date | null;
  next: Date | null;
  remaining: number;
  fullSchedule: boolean;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
}) {
  const short = (date: Date, weekday = true) => formatShortDate(date, locale, asOf, weekday);
  return (
    <section aria-labelledby="run" className="ai-run">
      <h2 id="run" className="sr-only">
        {t.production.run}
      </h2>
      <p className="ai-run__status">
        {!next ? (
          t.production.noUpcoming
        ) : fullSchedule && end ? (
          t.production.remaining(remaining, short(end))
        ) : (
          <>
            {t.production.nextPerformance}:{" "}
            <time dateTime={isoDateTime(next)}>{formatPerformance(next, locale, asOf)}</time>
          </>
        )}
      </p>
      {progress !== null && (
        <>
          <div
            className="ai-run__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={t.production.runProgress(progress)}
          >
            <div className="ai-run__fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="ai-run__line">
            <span>{premiere && `${t.production.premiere} ${short(premiere, false)}`}</span>
            {end && (
              <span>
                {t.production.ends} <time dateTime={isoDateTime(end)}>{short(end, false)}</time>
              </span>
            )}
          </p>
        </>
      )}
    </section>
  );
}
