import { ProductionType } from "@/generated/prisma/enums";
import type { ProductionCard } from "./types";

export interface Filters {
  city?: string;
  type?: ProductionType;
  lang?: string;
  subs?: string;
}

export const FILTER_KEYS = ["city", "type", "lang", "subs"] as const satisfies ReadonlyArray<keyof Filters>;

export interface FilterOptions {
  city: string[];
  type: ProductionType[];
  lang: string[];
  subs: string[];
}

const TYPE_ORDER = Object.values(ProductionType);

/**
 * On since the live run of 18 Oct 2026 parsed Kansallisteatteri's per-performance
 * subtitles. A card matches when any performance in the window has the language.
 */
export const SUBTITLE_FILTER_ENABLED = true;

/** Only offer choices that match something, so no filter ever leads to an empty page by itself. */
export function filterOptions(cards: ProductionCard[]): FilterOptions {
  const unique = <T,>(values: T[]) => [...new Set(values)];
  return {
    city: unique(cards.map((card) => card.theatre.city)).sort((a, b) => a.localeCompare(b, "fi")),
    type: unique(cards.map((card) => card.type)).sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)),
    lang: unique(cards.flatMap((card) => card.languages)).sort(),
    subs: SUBTITLE_FILTER_ENABLED ? unique(cards.flatMap((card) => card.subtitleLangs)).sort() : [],
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
  return filters;
}

export function applyFilters(cards: ProductionCard[], filters: Filters): ProductionCard[] {
  return cards.filter(
    (card) =>
      (!filters.city || card.theatre.city === filters.city) &&
      (!filters.type || card.type === filters.type) &&
      (!filters.lang || card.languages.includes(filters.lang)) &&
      (!filters.subs || card.subtitleLangs.includes(filters.subs)),
  );
}

export function hasFilters(filters: Filters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}
