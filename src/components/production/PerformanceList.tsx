import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { PerformanceRow } from "@/lib/catalogue/types";
import { formatPerformance, isoDateTime } from "@/lib/format";

const VISIBLE = 3;

interface RowProps {
  row: PerformanceRow;
  slug: string;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
}

/** The .ics file for one performance (src/app/api/calendar). */
export function calendarHref(slug: string, startsAt: Date, locale: Locale): string {
  return `/api/calendar?${new URLSearchParams({ show: slug, at: startsAt.toISOString(), lang: locale }).toString()}`;
}

function Row({ row, slug, asOf, locale, t }: RowProps) {
  const when = formatPerformance(row.startsAt, locale, asOf);
  const meta = [row.stage, subtitleText(row.subtitleLangs, t)].filter(Boolean);
  return (
    <li className="ai-perf">
      <span className="ai-perf__when">
        <time dateTime={isoDateTime(row.startsAt)} className="ai-perf__date">
          {when}
        </time>
        {meta.length > 0 && <span className="ai-perf__stage">{meta.join(" · ")}</span>}
        <a href={calendarHref(slug, row.startsAt, locale)} className="ai-perf__cal" aria-label={`${t.production.addToCalendar}: ${when}`}>
          <span aria-hidden="true">＋&nbsp;</span>
          {t.production.addToCalendar}
        </a>
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

/** Subtitle languages a reader can act on: "wordless" (zxx) is not a subtitle language. */
export function subtitleCodes(codes: string[]): string[] {
  return codes.filter((code) => code !== "zxx");
}

/** "Tekstitys: englanti, suomi", in words: codes like "FI" or "ZXX" never reach the page. */
export function subtitleText(codes: string[], t: Dictionary): string | null {
  const names = subtitleCodes(codes).map((code) => t.languages[code] ?? code);
  return names.length > 0 ? `${t.production.subtitles}: ${names.join(", ")}` : null;
}

/** The next three dates; the rest open in place (no JavaScript needed). */
export function PerformanceList({
  rows,
  slug,
  asOf,
  locale,
  t,
}: {
  rows: PerformanceRow[];
  slug: string;
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
          <Row key={row.startsAt.toISOString()} row={row} slug={slug} asOf={asOf} locale={locale} t={t} />
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
              <Row key={row.startsAt.toISOString()} row={row} slug={slug} asOf={asOf} locale={locale} t={t} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
