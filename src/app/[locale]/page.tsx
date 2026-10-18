import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { applyFilters, filterOptions, parseFilters } from "@/lib/catalogue/filters";
import { getOnStage } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";

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
    <div className="space-y-8">
      <FilterBar options={options} filters={filters} locale={locale} t={t} />

      {closing.length > 0 && (
        <section aria-labelledby="closing" className="rounded border-l-4 border-accent bg-card px-4 py-3">
          <h2 id="closing" className="text-2xl font-semibold">
            {t.home.closingSoon}
          </h2>
          <p className="text-base text-ink-muted">{t.home.closingSoonIntro}</p>
          <ul>
            {closing.map((card) => (
              <ProductionCard
                key={card.slug}
                card={card}
                asOf={asOf}
                locale={locale}
                t={t}
                note={card.last ? t.home.closes(formatDate(card.last, locale)) : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all">
        <h2 id="all" className="text-lg font-semibold text-ink-muted" aria-live="polite">
          {t.home.count(shown.length)}
        </h2>
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
        <h1 className="text-4xl font-semibold">{t.home.title}</h1>
        <p className="mt-1 text-lg text-ink-muted">{t.home.intro}</p>
      </header>
      <Suspense fallback={<p className="py-6 text-ink-muted">{t.home.loading}</p>}>
        <OnStage searchParams={searchParams} locale={locale} t={t} />
      </Suspense>
    </div>
  );
}
