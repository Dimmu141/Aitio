import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
        <Link href={href(locale)} className="flex min-h-tap items-center font-serif text-3xl font-semibold no-underline">
          {t.site.name}
        </Link>
        <Suspense fallback={null}>
          <LocaleSwitcher current={locale} label={t.site.language} />
        </Suspense>
      </div>
    </header>
  );
}
