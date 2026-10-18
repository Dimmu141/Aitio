import { t } from "@/i18n/fi";
import { formatDay, formatWeekdayDay } from "@/lib/format";
import type { RunStatus } from "@/lib/run-status";

/** The words carry the meaning; the bar only illustrates it. */
export function RunProgress({ status, now }: { status: RunStatus; now: Date }) {
  const { phase, opensAt, endsAt, remaining, progress } = status;
  if (phase === "ended" && endsAt) {
    return <p className="font-bold">{t.run.ended(formatDay(endsAt, now))}</p>;
  }
  const counts = [remaining > 0 ? t.run.remaining(remaining) : null, endsAt ? t.run.last(formatWeekdayDay(endsAt, now)) : null];
  if (phase === "upcoming" && opensAt) {
    // Nothing has passed yet, so an empty bar would only repeat the premiere date.
    return (
      <div className="grid gap-1">
        <p className="font-bold">{t.run.upcoming(formatWeekdayDay(opensAt, now))}</p>
        <p className="text-meta text-ink-muted">{counts.filter(Boolean).join(" · ")}</p>
      </div>
    );
  }
  const headline = counts.filter(Boolean).join(" · ");
  return (
    <div className="grid gap-2">
      <p className="font-bold">{headline}</p>
      {progress !== null && (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={t.run.progressAria(progress)}
            className="relative h-2.5 overflow-hidden rounded-sm border border-rule bg-paper-sunk"
          >
            <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-meta text-ink-muted">
            {opensAt && <span>{t.run.opens(formatDay(opensAt, now))}</span>}
            {endsAt && <span>{t.run.ends(formatDay(endsAt, now))}</span>}
          </div>
        </>
      )}
    </div>
  );
}
