import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { typeLabel } from "@/lib/catalogue/type-label";
import type { ProductionCard as Card } from "@/lib/catalogue/types";
import { formatPerformance, formatShortDate, formatTime, isoDateTime } from "@/lib/format";
import { posterTone } from "@/lib/poster";

/**
 * One programme row: colour edge from the poster ground, serif title, where and when.
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
}: {
  card: Card;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
  showTheatre?: boolean;
  when?: "date" | "time";
  heading?: "h3" | "h4";
  note?: string;
}) {
  const tone = posterTone(card.slug);
  const Title = heading;
  // KOM's only stage is called "KOM-teatteri": don't print the name twice.
  const stage = card.stage === card.theatre.name ? null : card.stage;
  const where = [showTheatre ? card.theatre.name : null, stage].filter(Boolean).join(" · ");
  const type = typeLabel(card.type, t);
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
        {where && <p>{where}</p>}
        <p className="text-meta text-ink-muted">
          {card.next && (
            <time dateTime={isoDateTime(card.next)} className="font-bold text-ink">
              {when === "time" ? t.production.at(formatTime(card.next, locale)) : formatPerformance(card.next, locale, asOf)}
            </time>
          )}
          {!card.next && card.year && t.production.performedIn(card.year)}
          {type && (card.next || card.year) && " · "}
          {type}
        </p>
        {card.closingSoon && card.end && (
          <p className="ai-badge ai-badge--urgent">
            <span aria-hidden="true">⏳</span> {t.production.ends} {formatShortDate(card.end, locale, asOf, false)}
          </p>
        )}
        {note && <p className="text-meta font-bold">{note}</p>}
      </div>
    </li>
  );
}
