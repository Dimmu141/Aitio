import type { Locale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/dictionaries";
import { href } from "@/i18n/paths";
import type { ProductionCard } from "@/lib/catalogue/types";
import { formatDate, formatPerformance } from "@/lib/format";

/** A second cron run in the same week (retry, manual call) must not send twice. */
export const RESEND_AFTER_DAYS = 6;

/** Closing within the window, minus what the user has already logged; closing first. */
export function digestItems(cards: ProductionCard[], seenSlugs: ReadonlySet<string>): ProductionCard[] {
  return cards
    .filter((card) => card.closingSoon && card.end && !seenSlugs.has(card.slug))
    .sort((a, b) => (a.end?.getTime() ?? 0) - (b.end?.getTime() ?? 0) || a.title.localeCompare(b.title, "fi"));
}

export interface DigestLinks {
  absolute: (path: string) => string;
  unsubscribeUrl: string;
}

export interface DigestEmail {
  subject: string;
  text: string;
}

/** A performance time when the end is a listed performance, else the theatre's end date. */
function lastDate(card: ProductionCard, locale: Locale, asOf: Date): string {
  if (!card.end) return "";
  return card.end === card.last ? formatPerformance(card.end, locale, asOf) : formatDate(card.end, locale);
}

/**
 * Plain text on purpose: readable in every client, nothing to render or block.
 * Shows on the user's "Haluan nähdä" list come first, under their own heading.
 */
export function composeDigest(
  locale: Locale,
  items: ProductionCard[],
  links: DigestLinks,
  asOf: Date,
  watched: ReadonlySet<string> = new Set(),
): DigestEmail {
  const t = dictionaryFor(locale);
  const block = (card: ProductionCard) =>
    [
      `${card.title}, ${card.theatre.name}`,
      card.end ? t.digest.lastPerformance(lastDate(card, locale, asOf)) : "",
      links.absolute(href(locale, "esitys", card.slug)),
    ]
      .filter(Boolean)
      .join("\n");
  const saved = items.filter((card) => watched.has(card.slug));
  const others = items.filter((card) => !watched.has(card.slug));
  const sections =
    saved.length > 0
      ? [t.digest.savedIntro, ...saved.map(block), ...(others.length > 0 ? [t.digest.othersIntro, ...others.map(block)] : [])]
      : [t.digest.intro, ...others.map(block)];
  return {
    subject: saved.length > 0 ? t.digest.subjectSaved(saved.length) : t.digest.subject(items.length),
    text: [...sections, `${t.site.name}\n${t.digest.footer(links.absolute(href(locale, "asetukset")), links.unsubscribeUrl)}`].join(
      "\n\n",
    ),
  };
}
