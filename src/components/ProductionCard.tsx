import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import type { ProductionCard as Card } from "@/lib/catalogue/types";
import { formatPerformance, isoDateTime } from "@/lib/format";
import { posterTone } from "@/lib/poster";

/** One programme row: colour edge from the poster tone, serif title, where and when. */
export function ProductionCard({
  card,
  asOf,
  locale,
  t,
  showTheatre = true,
  note,
}: {
  card: Card;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
  showTheatre?: boolean;
  note?: string;
}) {
  const tone = posterTone(card.slug);
  const where = [showTheatre ? card.theatre.name : null, card.stage].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3 border-b border-rule py-4">
      <span aria-hidden="true" className="w-2 shrink-0 rounded-sm" style={{ backgroundColor: tone.background }} />
      <div className="min-w-0 space-y-1">
        <h3 className="text-2xl font-semibold">
          <Link href={href(locale, "esitys", card.slug)} className="break-words">
            {card.title}
          </Link>
        </h3>
        {where && <p>{where}</p>}
        <p className="text-base text-ink-muted">
          {t.types[card.type]}
          {card.next && (
            <>
              {" · "}
              <time dateTime={isoDateTime(card.next)} className="font-semibold text-ink">
                {formatPerformance(card.next, locale, asOf)}
              </time>
            </>
          )}
          {!card.next && card.year && <> · {t.production.performedIn(card.year)}</>}
        </p>
        {note && <p className="text-base font-semibold text-accent">{note}</p>}
      </div>
    </li>
  );
}
