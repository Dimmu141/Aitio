export const LOCALES = ["fi", "sv", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fi";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tags for Intl formatting: Finland-Swedish, and British English for day-month order. */
export const INTL_LOCALE: Record<Locale, string> = { fi: "fi-FI", sv: "sv-FI", en: "en-GB" };

/**
 * Public URL segments per locale. The app directory uses the Finnish segment;
 * proxy.ts rewrites the Swedish and English ones to it.
 */
export const SEGMENTS = {
  esitys: { fi: "esitys", sv: "forestallning", en: "show" },
  teatteri: { fi: "teatteri", sv: "teater", en: "theatre" },
  henkilo: { fi: "henkilo", sv: "person", en: "person" },
  kirjaudu: { fi: "kirjaudu", sv: "logga-in", en: "sign-in" },
  merkitse: { fi: "merkitse", sv: "markera", en: "log" },
  paivakirja: { fi: "paivakirja", sv: "dagbok", en: "diary" },
  asetukset: { fi: "asetukset", sv: "installningar", en: "settings" },
  ilmoita: { fi: "ilmoita", sv: "anmal", en: "report" },
  yllapito: { fi: "yllapito", sv: "admin", en: "admin" },
  "peru-tilaus": { fi: "peru-tilaus", sv: "avsluta-prenumeration", en: "unsubscribe" },
} as const satisfies Record<string, Record<Locale, string>>;

export type Section = keyof typeof SEGMENTS;
