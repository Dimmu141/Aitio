import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-measure space-y-2 px-4 py-6 text-meta text-ink-muted">
        <p>{t.footer.facts}</p>
        <p>
          <Link href={href(locale, "tietosuoja")} className="inline-flex min-h-tap items-center">
            {t.footer.privacy}
          </Link>
        </p>
      </div>
    </footer>
  );
}
