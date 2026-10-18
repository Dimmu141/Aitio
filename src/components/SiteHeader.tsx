import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { alternates, href } from "@/i18n/paths";
import { LocaleLinks } from "./LocaleLinks";
import { LocaleSwitcher } from "./LocaleSwitcher";

/** Top bar: wordmark and languages. Sections live in the bottom tab bar. */
export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="ai-topbar">
      <div className="mx-auto flex min-h-tap-primary max-w-measure items-center justify-between gap-x-4 px-4">
        <Link href={href(locale)} className="ai-wordmark">
          {t.site.name}
        </Link>
        {/* On prerendered pages the pathname only arrives with JavaScript; until then, and
            without it, the links point to each language's front page. */}
        <Suspense fallback={<LocaleLinks current={locale} label={t.site.language} hrefs={alternates()} />}>
          <LocaleSwitcher current={locale} label={t.site.language} />
        </Suspense>
      </div>
    </header>
  );
}
