import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { PerformanceRow } from "@/lib/catalogue/types";
import { formatPerformance, isoDateTime } from "@/lib/format";

const VISIBLE = 3;

function Row({ row, asOf, locale, t }: { row: PerformanceRow; asOf: Date; locale: Locale; t: Dictionary }) {
  const meta = [row.stage, row.subtitleLangs.length > 0 ? subtitleText(row.subtitleLangs, t) : null].filter(Boolean);
  return (
    <li className="ai-perf">
      <span className="ai-perf__when">
        <time dateTime={isoDateTime(row.startsAt)} className="ai-perf__date">
          {formatPerformance(row.startsAt, locale, asOf)}
        </time>
        {meta.length > 0 && <span className="ai-perf__stage">{meta.join(" · ")}</span>}
      </span>
      {row.ticketUrl && (
        <a href={row.ticketUrl} rel="noopener external" className="ai-perf__buy">
          {t.production.performanceTickets}
          <span aria-hidden="true">&nbsp;↗</span>
          <span className="sr-only"> ({t.production.externalLink})</span>
        </a>
      )}
    </li>
  );
}

export function subtitleText(codes: string[], t: Dictionary): string {
  return `${t.production.subtitles} ${codes.map((code) => code.toUpperCase()).join(" · ")}`;
}

/** The next three dates; the rest open in place (no JavaScript needed). */
export function PerformanceList({
  rows,
  asOf,
  locale,
  t,
}: {
  rows: PerformanceRow[];
  asOf: Date;
  locale: Locale;
  t: Dictionary;
}) {
  if (rows.length === 0) return null;
  const first = rows.slice(0, VISIBLE);
  const rest = rows.slice(VISIBLE);
  return (
    <section aria-labelledby="performances">
      <h2 id="performances" className="sr-only">
        {t.production.performances}
      </h2>
      <ul className="ai-perfs">
        {first.map((row) => (
          <Row key={row.startsAt.toISOString()} row={row} asOf={asOf} locale={locale} t={t} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="ai-perf cursor-pointer list-none group-open:hidden [&::-webkit-details-marker]:hidden">
            <span className="ai-perf__date">{t.production.moreDates(rest.length)}</span>
            <span className="ai-perf__buy">{t.production.allDates}</span>
          </summary>
          <ul>
            {rest.map((row) => (
              <Row key={row.startsAt.toISOString()} row={row} asOf={asOf} locale={locale} t={t} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
