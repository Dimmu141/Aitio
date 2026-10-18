"use client";

import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/paths";

const NAMES: Record<Locale, string> = { fi: "Suomi", sv: "Svenska", en: "English" };

/** Links to the current page in the other languages. Plain links: works without JavaScript after render. */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <a
              href={switchLocalePath(pathname, locale)}
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
