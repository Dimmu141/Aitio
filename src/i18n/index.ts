import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { dictionaryFor } from "./dictionaries";
import type { Dictionary } from "./dictionaries/fi";

export { dictionaryFor };

/** The current locale from the `[locale]` root segment; unknown values are a 404. */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaryFor(locale) };
}
