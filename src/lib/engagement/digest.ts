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

/** Plain text on purpose: readable in every client, nothing to render or block. */
export function composeDigest(locale: Locale, items: ProductionCard[], links: DigestLinks, asOf: Date): DigestEmail {
  const t = dictionaryFor(locale);
  const lines = items.map((card) =>
    [
      `${card.title}, ${card.theatre.name}`,
      card.end ? t.digest.lastPerformance(lastDate(card, locale, asOf)) : "",
      links.absolute(href(locale, "esitys", card.slug)),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return {
    subject: t.digest.subject(items.length),
    text: [
      t.digest.intro,
      ...lines,
      `${t.site.name}\n${t.digest.footer(links.absolute(href(locale, "asetukset")), links.unsubscribeUrl)}`,
    ].join("\n\n"),
  };
}
