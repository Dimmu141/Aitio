import { LOCALES, type Locale } from "@/i18n/config";

const NAMES: Record<Locale, string> = { fi: "Suomi", sv: "Svenska", en: "English" };

/** The language links themselves, as two-letter codes; LocaleSwitcher decides where they point. */
export function LocaleLinks({ current, label, hrefs }: { current: Locale; label: string; hrefs: Record<Locale, string> }) {
  return (
    <nav aria-label={label}>
      <ul className="flex">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <a
              href={hrefs[locale]}
              hrefLang={locale}
              lang={locale}
              aria-label={`${NAMES[locale]} (${locale.toUpperCase()})`}
              aria-current={locale === current ? "true" : undefined}
              className="inline-flex min-h-tap min-w-tap items-center justify-center text-meta font-bold tracking-[0.06em] text-ink-muted no-underline hover:text-ink aria-[current]:text-ink aria-[current]:underline aria-[current]:decoration-2 aria-[current]:underline-offset-[6px]"
            >
              {locale.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
