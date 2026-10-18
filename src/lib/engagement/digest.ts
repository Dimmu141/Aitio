import type { Locale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/dictionaries";
import { href } from "@/i18n/paths";
import type { ProductionCard } from "@/lib/catalogue/types";
import { formatPerformance } from "@/lib/format";

/** A second cron run in the same week (retry, manual call) must not send twice. */
export const RESEND_AFTER_DAYS = 6;

/** Closing within the window, minus what the user has already logged; closing first. */
export function digestItems(cards: ProductionCard[], seenSlugs: ReadonlySet<string>): ProductionCard[] {
  return cards
    .filter((card) => card.closingSoon && card.last && !seenSlugs.has(card.slug))
    .sort((a, b) => (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0) || a.title.localeCompare(b.title, "fi"));
}

export interface DigestLinks {
  absolute: (path: string) => string;
  unsubscribeUrl: string;
}

export interface DigestEmail {
  subject: string;
  text: string;
}

/** Plain text on purpose: readable in every client, nothing to render or block. */
export function composeDigest(locale: Locale, items: ProductionCard[], links: DigestLinks, asOf: Date): DigestEmail {
  const t = dictionaryFor(locale);
  const lines = items.map((card) =>
    [
      `${card.title}, ${card.theatre.name}`,
      card.last ? t.digest.lastPerformance(formatPerformance(card.last, locale, asOf)) : "",
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
