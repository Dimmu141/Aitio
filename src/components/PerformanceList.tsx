import { t } from "@/i18n/fi";
import { formatPerformance } from "@/lib/format";

type Performance = { startsAt: Date; stage: string | null; ticketUrl: string | null };

const VISIBLE = 3;

function PerformanceRow({ performance, mainStage, now }: { performance: Performance; mainStage: string | null; now: Date }) {
  const when = formatPerformance(performance.startsAt, now);
  const stage = performance.stage && performance.stage !== mainStage ? performance.stage : null;
  return (
    <li className="flex min-h-16 items-center justify-between gap-3 border-b border-rule py-2">
      <div className="grid">
        <span className="font-bold">{when}</span>
        {stage && <span className="text-meta text-ink-muted">{stage}</span>}
      </div>
      {performance.ticketUrl && (
        <a
          href={performance.ticketUrl}
          target="_blank"
          rel="noopener"
          aria-label={t.production.ticketsAria(when)}
          className="inline-flex min-h-tap shrink-0 items-center rounded-md border-2 border-rule-strong px-4 text-[16px] font-bold whitespace-nowrap text-ink no-underline hover:border-accent hover:text-accent-strong"
        >
          {t.production.tickets} ↗
        </a>
      )}
    </li>
  );
}

/** Upcoming dates, each with its own ticket link: ticket intent is always tied to a date. */
export function PerformanceList({ performances, mainStage, now }: { performances: Performance[]; mainStage: string | null; now: Date }) {
  if (performances.length === 0) {
    return <p className="text-ink-muted">{t.production.noUpcoming}</p>;
  }
  const visible = performances.slice(0, VISIBLE);
  const rest = performances.slice(VISIBLE);
  const row = (performance: Performance) => (
    <PerformanceRow key={performance.startsAt.toISOString()} performance={performance} mainStage={mainStage} now={now} />
  );
  return (
    <div>
      <ul className="border-t border-rule">{visible.map(row)}</ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-16 cursor-pointer items-center border-b border-rule font-bold text-accent marker:content-none group-open:hidden">
            {t.production.morePerformances(rest.length)}
          </summary>
          <ul>{rest.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
