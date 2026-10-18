import type { Locale } from "../config";
import { en } from "./en";
import { type Dictionary, fi } from "./fi";
import { sv } from "./sv";

const DICTIONARIES: Record<Locale, Dictionary> = { fi, sv, en };

/** Plain lookup, safe anywhere (route handlers, emails); pages use getDictionary() instead. */
export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
