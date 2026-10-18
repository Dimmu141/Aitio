import { ExternalLink } from "@/components/ExternalLink";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ProductionPage } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";

/** Outbound links only: we never store or show review text, and never compute a critic score. */
export function CriticLinks({ critics, locale, t }: { critics: ProductionPage["critics"]; locale: Locale; t: Dictionary }) {
  return (
    <section aria-labelledby="critics" className="space-y-2">
      <h2 id="critics" className="text-2xl font-semibold">
        {t.production.critics}
      </h2>
      {critics.length === 0 ? (
        <p className="text-ink-muted">{t.production.noCritics}</p>
      ) : (
        <>
          <p className="text-base text-ink-muted">{t.production.criticsIntro}</p>
          <ul>
            {critics.map((critic) => (
              <li key={critic.url} className="border-b border-rule">
                <ExternalLink href={critic.url} hint={t.production.externalLink} className="flex min-h-tap items-center py-2">
                  {critic.outlet}
                  {critic.publishedAt && <span className="text-ink-muted">, {formatDate(critic.publishedAt, locale)}</span>}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
