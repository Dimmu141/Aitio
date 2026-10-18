import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { applyFilters, filterOptions, parseFilters } from "@/lib/catalogue/filters";
import { getOnStage } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";

/**
 * Rendered per request on purpose: the list depends on the query string, and inside
 * <Suspense> it would stream as a hidden template that never appears without JavaScript.
 * The data itself comes from the hour-long catalogue cache, so this stays cheap.
 */
export const instant = false;

export async function generateMetadata() {
  const { locale, t } = await getDictionary();
  return pageMetadata({ locale, title: t.home.title, description: t.site.description });
}

async function OnStage({
  searchParams,
  locale,
  t,
}: {
  searchParams: PageProps<"/[locale]">["searchParams"];
  locale: Locale;
  t: Dictionary;
}) {
  const [{ asOf, cards }, params] = await Promise.all([getOnStage(), searchParams]);
  const options = filterOptions(cards);
  const filters = parseFilters(params, options);
  const shown = applyFilters(cards, filters);
  const closing = shown.filter((card) => card.closingSoon);

  return (
    <div>
      <FilterBar options={options} filters={filters} locale={locale} t={t} />

      {closing.length > 0 && (
        <section aria-labelledby="closing" className="ai-section">
          <div className="ai-section__head">
            <h2 id="closing" className="ai-section__title">
              <span aria-hidden="true">⏳ </span>
              {t.home.closingSoon}
            </h2>
            <p className="ai-section__aside">{t.home.closingSoonIntro}</p>
          </div>
          <ul>
            {closing.map((card) => (
              <ProductionCard
                key={card.slug}
                card={card}
                asOf={asOf}
                locale={locale}
                t={t}
                note={card.end ? t.home.closes(formatDate(card.end, locale)) : undefined}
              />
            ))}
          </ul>
          <p className="pt-2">
            <Link href={`${href(locale, "asetukset")}#kooste`} className="inline-flex min-h-tap items-center">
              {t.digest.homeLink}
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="all" className="ai-section">
        <div className="ai-section__head">
          <h2 id="all" className="ai-section__title" aria-live="polite">
            {t.home.count(shown.length)}
          </h2>
        </div>
        {shown.length === 0 ? (
          <p className="py-6">{t.home.empty}</p>
        ) : (
          <ul>
            {shown.map((card) => (
              <ProductionCard key={card.slug} card={card} asOf={asOf} locale={locale} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/[locale]">) {
  const { locale, t } = await getDictionary();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display">{t.home.title}</h1>
        <p className="mt-1 text-ink-muted">{t.home.intro}</p>
      </header>
      <OnStage searchParams={searchParams} locale={locale} t={t} />
    </div>
  );
}
