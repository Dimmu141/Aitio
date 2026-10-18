import { ExternalLink } from "@/components/ExternalLink";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { PerformanceRow } from "@/lib/catalogue/types";
import { formatPerformance, isoDateTime } from "@/lib/format";

const VISIBLE = 6;

function Row({ row, asOf, locale, t }: { row: PerformanceRow; asOf: Date; locale: Locale; t: Dictionary }) {
  return (
    <li className="flex min-h-tap flex-wrap items-center justify-between gap-x-4 border-b border-rule py-2">
      <span>
        <time dateTime={isoDateTime(row.startsAt)} className="font-semibold">
          {formatPerformance(row.startsAt, locale, asOf)}
        </time>
        {row.stage && <span className="text-ink-muted"> · {row.stage}</span>}
      </span>
      {row.ticketUrl && (
        <ExternalLink href={row.ticketUrl} hint={t.production.externalLink} className="inline-flex min-h-tap items-center">
          {t.production.performanceTickets}
        </ExternalLink>
      )}
    </li>
  );
}

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
      <h2 id="performances" className="mb-2 text-2xl font-semibold">
        {t.production.performances}
      </h2>
      <ul>
        {first.map((row) => (
          <Row key={row.startsAt.toISOString()} row={row} asOf={asOf} locale={locale} t={t} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-tap cursor-pointer items-center font-semibold text-accent underline group-open:hidden">
            {t.production.showAllPerformances(rows.length)}
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
