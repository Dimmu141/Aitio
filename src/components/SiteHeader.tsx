import Link from "next/link";
import { t } from "@/i18n/fi";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex min-h-14 w-full max-w-measure items-center justify-between gap-4 px-4">
        <Link href="/" className="font-serif text-[26px] leading-none font-semibold tracking-[-0.01em] text-ink no-underline">
          {t.site.name}
        </Link>
        <nav aria-label="Päävalikko" className="flex gap-1">
          <Link href="/" className="flex min-h-tap items-center px-2 font-bold text-ink no-underline hover:text-accent">
            {t.site.nav.programme}
          </Link>
          <Link href="/teatterit" className="flex min-h-tap items-center px-2 font-bold text-ink no-underline hover:text-accent">
            {t.site.nav.theatres}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-rule">
      <p className="mx-auto w-full max-w-measure px-4 py-6 text-meta text-ink-muted">{t.site.footer}</p>
    </footer>
  );
}
