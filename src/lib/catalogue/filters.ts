import { ProductionType } from "@/generated/prisma/enums";
import { helsinkiDate } from "@/lib/format";
import type { ProductionCard } from "./types";
import { DEFAULT_WHEN, firstOn, WHEN, type When, whenDates } from "./when";

export interface Filters {
  city?: string;
  type?: ProductionType;
  lang?: string;
  subs?: string;
  when?: When;
}

export const FILTER_KEYS = ["city", "type", "lang", "subs", "when"] as const satisfies ReadonlyArray<keyof Filters>;

export interface FilterOptions {
  city: string[];
  type: ProductionType[];
  lang: string[];
  subs: string[];
  when: When[];
}

/**
 * A language choice of its own: shows a visitor without Finnish (or Swedish) can follow,
 * because they are in English, have no words, or have English subtitles soon.
 */
export const ENGLISH_FRIENDLY = "english";

export function isEnglishFriendly(card: ProductionCard): boolean {
  return card.languages.includes("en") || card.languages.includes("zxx") || card.subtitleLangs.includes("en");
}

function speaks(card: ProductionCard, lang: string): boolean {
  return lang === ENGLISH_FRIENDLY ? isEnglishFriendly(card) : card.languages.includes(lang);
}

const TYPE_ORDER = Object.values(ProductionType);

/**
 * On since the live run of 18 Oct 2026 parsed Kansallisteatteri's per-performance
 * subtitles. A card matches when any performance in the window has the language.
 */
export const SUBTITLE_FILTER_ENABLED = true;

/** Only offer choices that match something, so no filter ever leads to an empty page by itself. */
export function filterOptions(cards: ProductionCard[], asOf: Date): FilterOptions {
  const unique = <T,>(values: T[]) => [...new Set(values)];
  return {
    city: unique(cards.map((card) => card.theatre.city)).sort((a, b) => a.localeCompare(b, "fi")),
    // "Muu" is the classifier's don't-know, not a kind of show anyone looks for.
    type: unique(cards.map((card) => card.type).filter((type) => type !== "OTHER")).sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)),
    lang: [
      ...unique(cards.flatMap((card) => card.languages).filter((lang) => lang !== "zxx")).sort(),
      ...(cards.some(isEnglishFriendly) ? [ENGLISH_FRIENDLY] : []),
    ],
    // "Wordless" is never a subtitle language to choose.
    subs: SUBTITLE_FILTER_ENABLED ? unique(cards.flatMap((card) => card.subtitleLangs)).filter((code) => code !== "zxx").sort() : [],
    when: WHEN.filter((when) => {
      const dates = whenDates(when, asOf);
      return cards.some((card) => firstOn(card.soon, dates));
    }),
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Read filters from the query string, ignoring anything that isn't a current option. */
export function parseFilters(params: SearchParams, options: FilterOptions): Filters {
  const filters: Filters = {};
  const city = single(params.city);
  if (city && options.city.includes(city)) filters.city = city;
  const type = single(params.type);
  const knownType = options.type.find((candidate) => candidate === type);
  if (knownType) filters.type = knownType;
  const lang = single(params.lang);
  if (lang && options.lang.includes(lang)) filters.lang = lang;
  const subs = single(params.subs);
  if (subs && options.subs.includes(subs)) filters.subs = subs;
  const when = options.when.find((candidate) => candidate === single(params.when));
  if (when) filters.when = when;
  return filters;
}

/** The time range in force: the chosen one, else "soon", else (nothing soon) the whole window. */
export function effectiveWhen(filters: Filters, options: FilterOptions): When {
  return filters.when ?? (options.when.includes(DEFAULT_WHEN) ? DEFAULT_WHEN : "all");
}

/**
 * Cards matching every choice. With a time range, a card keeps only its performances on
 * those days (`soon`), and its `next` becomes the first of them.
 */
export function applyFilters(cards: ProductionCard[], filters: Filters, asOf: Date): ProductionCard[] {
  const dates = filters.when ? whenDates(filters.when, asOf) : null;
  return cards.flatMap((card) => {
    const matches =
      (!filters.city || card.theatre.city === filters.city) &&
      (!filters.type || card.type === filters.type) &&
      (!filters.lang || speaks(card, filters.lang)) &&
      (!filters.subs || card.subtitleLangs.includes(filters.subs));
    if (!matches) return [];
    if (!dates) return [card];
    const next = firstOn(card.soon, dates);
    return next ? [{ ...card, next, soon: card.soon.filter((startsAt) => dates.has(helsinkiDate(startsAt))) }] : [];
  });
}

export function hasFilters(filters: Filters, keys: ReadonlyArray<keyof Filters> = FILTER_KEYS): boolean {
  return keys.some((key) => filters[key] !== undefined);
}

/** The query string for these filters, with one choice changed (undefined removes it). */
export function filterQuery(filters: Filters, change: Partial<Filters> = {}): string {
  const merged: Filters = { ...filters, ...change };
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
