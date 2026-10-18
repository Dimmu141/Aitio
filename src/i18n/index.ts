import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { type Dictionary, fi } from "./dictionaries/fi";
import { sv } from "./dictionaries/sv";

const DICTIONARIES: Record<Locale, Dictionary> = { fi, sv, en };

/** The current locale from the `[locale]` root segment; unknown values are a 404. */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
