import { LOCALES, type Locale } from "@/i18n/config";

const NAMES: Record<Locale, string> = { fi: "Suomi", sv: "Svenska", en: "English" };

/** The language links themselves; LocaleSwitcher decides where they point. */
export function LocaleLinks({ current, label, hrefs }: { current: Locale; label: string; hrefs: Record<Locale, string> }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <a
              href={hrefs[locale]}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className="inline-flex min-h-tap items-center rounded px-2 text-base underline-offset-4 aria-[current]:font-semibold aria-[current]:underline"
            >
              {NAMES[locale]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
