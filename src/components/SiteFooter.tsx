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
      <div className="mx-auto max-w-measure space-y-4 px-4 pt-6 pb-8">
        <p className="ai-wordmark min-h-0">{t.site.name}</p>
        <p className="text-meta text-ink-muted">{t.footer.facts}</p>
        <ul className="grid gap-x-6 sm:grid-cols-2">
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
            <li className="sm:col-span-2">
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
