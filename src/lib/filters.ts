import { ProductionType } from "@/generated/prisma/enums";

export type Filters = {
  city?: string;
  type?: ProductionType;
  language?: string;
  subtitles?: string;
};

export type Filterable = {
  type: ProductionType;
  theatre: { city: string };
  languages: string[];
  subtitleLangs: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

export const LANGUAGE_CODES = ["fi", "sv", "en"] as const;

function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

function isProductionType(value: string): value is ProductionType {
  return value in ProductionType;
}

function isLanguage(value: string): boolean {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

/** Read ?kaupunki=&tyyppi=&kieli=&tekstitys= and drop anything unknown. */
export function parseFilters(params: SearchParams, cities: string[]): Filters {
  const city = single(params.kaupunki);
  const type = single(params.tyyppi)?.toUpperCase();
  const language = single(params.kieli)?.toLowerCase();
  const subtitles = single(params.tekstitys)?.toLowerCase();
  return {
    city: city && cities.includes(city) ? city : undefined,
    type: type && isProductionType(type) ? type : undefined,
    language: language && isLanguage(language) ? language : undefined,
    subtitles: subtitles && isLanguage(subtitles) ? subtitles : undefined,
  };
}

export function applyFilters<T extends Filterable>(items: T[], filters: Filters): T[] {
  return items.filter(
    (item) =>
      (!filters.city || item.theatre.city === filters.city) &&
      (!filters.type || item.type === filters.type) &&
      (!filters.language || item.languages.includes(filters.language)) &&
      (!filters.subtitles || item.subtitleLangs.includes(filters.subtitles)),
  );
}

export function hasFilters(filters: Filters): boolean {
  return Object.values(filters).some(Boolean);
}
