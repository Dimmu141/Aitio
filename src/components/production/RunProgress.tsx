import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { formatDate, formatPerformance, isoDateTime } from "@/lib/format";

export function RunProgress({
  progress,
  premiere,
  last,
  next,
  asOf,
  locale,
  t,
}: {
  progress: number | null;
  premiere: Date | null;
  last: Date | null;
  next: Date | null;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section aria-labelledby="run" className="space-y-3">
      <h2 id="run" className="sr-only">
        {t.production.run}
      </h2>
      <p className="text-xl">
        <span className="text-ink-muted">{t.production.nextPerformance}: </span>
        {next ? (
          <time dateTime={isoDateTime(next)} className="font-semibold">
            {formatPerformance(next, locale, asOf)}
          </time>
        ) : (
          t.production.noUpcoming
        )}
      </p>
      {progress !== null && (
        <div>
          <progress
            value={progress}
            max={100}
            aria-label={t.production.runProgress(progress)}
            className="h-3 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-card [&::-webkit-progress-value]:bg-accent"
          />
          <div className="mt-1 flex justify-between gap-4 text-base text-ink-muted">
            <span>{premiere ? `${t.production.premiere} ${formatDate(premiere, locale)}` : ""}</span>
            {last && (
              <span className="text-right">
                {t.production.lastPerformance} <time dateTime={isoDateTime(last)}>{formatDate(last, locale)}</time>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
