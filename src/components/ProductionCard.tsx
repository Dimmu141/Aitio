import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { typeLabel } from "@/lib/catalogue/type-label";
import { durationLabel } from "@/lib/catalogue/duration";
import type { ProductionCard as Card } from "@/lib/catalogue/types";
import { formatPerformance, formatShortDate, formatTime, isoDateTime } from "@/lib/format";
import { theatreTone } from "@/lib/poster";
import { subtitleText } from "./production/PerformanceList";

/**
 * One programme row: colour edge of its theatre, serif title, where and when.
 * Under a day heading (`when="time"`) the date is already said, so only the time shows.
 */
export function ProductionCard({
  card,
  asOf,
  locale,
  t,
  showTheatre = true,
  when = "date",
  heading = "h3",
  note,
  children,
}: {
  card: Card;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
  showTheatre?: boolean;
  when?: "date" | "time";
  heading?: "h3" | "h4";
  note?: string;
  /** Extra controls under the card, e.g. "Poista listalta" on the watchlist. */
  children?: ReactNode;
}) {
  const tone = theatreTone(card.theatre.slug);
  const Title = heading;
  // KOM's only stage is called "KOM-teatteri": don't print the name twice.
  const stage = card.stage === card.theatre.name ? null : card.stage;
  const where = [showTheatre ? card.theatre.name : null, stage].filter(Boolean).join(" · ");
  // The edge colour means the theatre (pairs of houses share one), so its name carries it too.
  const swatch = showTheatre && (
    <span aria-hidden="true" className={`ai-poster--${tone.name} mr-2 inline-block size-3 rounded-sm`} />
  );
  const type = typeLabel(card.type, t);
  const duration = durationText(card, t);
  const status = statusText(card, t);
  // Finnish is the default and goes unsaid; anything else is worth knowing before clicking.
  const language = [
    ...card.languages.filter((code) => code !== "fi").map((code) => t.production.spokenIn[code] ?? t.languages[code] ?? code),
    card.subtitleLangs.length > 0 ? subtitleText(card.subtitleLangs, t) : null,
  ].filter(Boolean);
  return (
    <li className="flex gap-3 border-b border-rule py-4">
      <span aria-hidden="true" className={`ai-poster--${tone.name} w-2 shrink-0 rounded-sm`} />
      <div className="min-w-0 space-y-1">
        <Title className="text-card">
          <Link
            href={href(locale, "esitys", card.slug)}
            className="break-words text-ink decoration-rule-strong hover:text-ink hover:decoration-current"
          >
            {card.title}
          </Link>
        </Title>
        {where && (
          <p>
            {swatch}
            {where}
          </p>
        )}
        <p className="text-meta text-ink-muted">
          {card.next && (
            <time dateTime={isoDateTime(card.next)} className="font-bold text-ink">
              {when === "time" ? t.production.at(formatTime(card.next, locale)) : formatPerformance(card.next, locale, asOf)}
            </time>
          )}
          {!card.next && status}
          {[type, duration].filter(Boolean).map((fact, index) => (
            <span key={index}>
              {(index > 0 || card.next || status) && " · "}
              {fact}
            </span>
          ))}
        </p>
        {language.length > 0 && <p className="text-meta text-ink-muted">{language.join(" · ")}</p>}
        {card.closingSoon && card.end && (
          <p className="ai-badge ai-badge--urgent">
            {t.production.ends} {formatShortDate(card.end, locale, asOf, false)}
          </p>
        )}
        {note && <p className="text-meta font-bold">{note}</p>}
        {children}
      </div>
    </li>
  );
}

/** "2 t 30 min, väliaika": the running time in the reader's language. */
/** For a card without a next date: "Tulossa", or "Esitetty 2024" once it has played. */
function statusText(card: Card, t: Dictionary): string | null {
  if (card.phase === "upcoming") return t.production.upcoming;
  return card.year ? t.production.performedIn(card.year) : null;
}

function durationText(card: Card, t: Dictionary): string | null {
  return durationLabel(card.duration, t.production);
}
