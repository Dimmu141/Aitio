import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { privacyConfig } from "@/lib/privacy";

/** Who runs this and where the data comes from: the trust signals a listings site needs. */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { email } = privacyConfig();
  return (
    <footer className="mt-12 border-t-2 border-ink bg-paper-sunk">
      <div className="mx-auto max-w-measure space-y-4 px-4 pt-6 pb-8 md:grid md:max-w-wide md:grid-cols-[3fr_2fr] md:gap-x-12 md:space-y-0">
        <div className="space-y-4">
          <p className="ai-wordmark min-h-0">{t.site.name}</p>
          <p className="text-meta text-ink-muted">{t.footer.facts}</p>
        </div>
        <ul className="grid gap-x-6 sm:grid-cols-2 md:grid-cols-1 md:content-start">
          <li>
            <Link href={href(locale, "tietoa")} className="inline-flex min-h-tap items-center font-bold">
              {t.footer.about}
            </Link>
          </li>
          <li>
            <Link href={href(locale, "tietosuoja")} className="inline-flex min-h-tap items-center font-bold">
              {t.footer.privacy}
            </Link>
          </li>
          {email && (
            <li className="sm:col-span-2 md:col-span-1">
              <span className="block text-meta text-ink-muted">{t.footer.contact}</span>
              <a href={`mailto:${email}`} className="inline-flex min-h-tap items-center font-bold">
                {email}
              </a>
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
