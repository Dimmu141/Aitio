import Link from "next/link";
import { ProductionCard } from "@/components/ProductionCard";
import { buttonPrimary, input } from "@/components/ui";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { getSearchIndex } from "@/lib/catalogue/queries";
import { isEmpty, MIN_QUERY_LENGTH, search, type SearchResults } from "@/lib/catalogue/search";
import { pageMetadata } from "@/lib/metadata";

/** Per request like the front page: the results depend on the query string and must render without JavaScript. */
export const instant = false;

export async function generateMetadata() {
  const { locale, t } = await getDictionary();
  // Result pages are endless and thin; the shows themselves are what search engines should index.
  return { ...pageMetadata({ locale, section: "haku", title: t.search.title, description: t.site.description }), robots: { index: false } };
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
}

function Results({ results, asOf, locale, t }: { results: SearchResults; asOf: Date; locale: Locale; t: Dictionary }) {
  return (
    <div className="space-y-2">
      {results.productions.length > 0 && (
        <section aria-labelledby="found-productions" className="ai-section">
          <h2 id="found-productions" className="ai-section__title">
            {t.search.productions}
          </h2>
          <ul className="md:grid md:grid-cols-2 md:gap-x-10">
            {results.productions.map((card) => (
              <ProductionCard key={card.slug} card={card} asOf={asOf} locale={locale} t={t} />
            ))}
          </ul>
        </section>
      )}
      {results.people.length > 0 && (
        <section aria-labelledby="found-people" className="ai-section">
          <h2 id="found-people" className="ai-section__title">
            {t.search.people}
          </h2>
          <ul className="md:grid md:grid-cols-2 md:gap-x-10">
            {results.people.map((person) => (
              <li key={person.slug} className="border-b border-rule">
                <Link href={href(locale, "henkilo", person.slug)} className="flex min-h-tap flex-wrap items-baseline gap-x-3 py-2 no-underline">
                  <span className="font-bold text-ink underline decoration-rule-strong">{person.name}</span>
                  <span className="text-meta text-ink-muted">{t.search.credits(person.productions)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.theatres.length > 0 && (
        <section aria-labelledby="found-theatres" className="ai-section">
          <h2 id="found-theatres" className="ai-section__title">
            {t.search.theatres}
          </h2>
          <ul>
            {results.theatres.map((theatre) => (
              <li key={theatre.slug} className="border-b border-rule">
                <Link href={href(locale, "teatteri", theatre.slug)} className="flex min-h-tap flex-wrap items-baseline gap-x-3 py-2 no-underline">
                  <span className="font-bold text-ink underline decoration-rule-strong">{theatre.name}</span>
                  <span className="text-meta text-ink-muted">{theatre.city}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/[locale]/haku">) {
  const [{ locale, t }, params, { asOf, index }] = await Promise.all([getDictionary(), searchParams, getSearchIndex()]);
  const query = single(params.q);
  const results = search(index, query);

  return (
    <div className="ai-wide space-y-6">
      <header className="max-w-measure space-y-4">
        <h1 className="text-display">{t.search.title}</h1>
        <form method="get" action={href(locale, "haku")} role="search" className="space-y-3">
          <label className="block space-y-1">
            <span className="font-bold">{t.search.label}</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              autoComplete="off"
              enterKeyHint="search"
              minLength={MIN_QUERY_LENGTH}
              className={input}
            />
          </label>
          <button type="submit" className={buttonPrimary}>
            {t.search.submit}
          </button>
        </form>
      </header>
      {query && !results && <p>{t.search.hint}</p>}
      {results && (isEmpty(results) ? <p aria-live="polite">{t.search.none(query)}</p> : <Results results={results} asOf={asOf} locale={locale} t={t} />)}
    </div>
  );
}
