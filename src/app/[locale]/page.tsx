import Link from "next/link";
import { FilterBar, WhenChips } from "@/components/FilterBar";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { applyFilters, filterOptions, parseFilters, effectiveWhen } from "@/lib/catalogue/filters";
import { getOnStage } from "@/lib/catalogue/queries";
import { formatDayHeading, formatShortDate } from "@/lib/format";
import { type Day, groupByDay, premieresSoon } from "@/lib/catalogue/days";
import type { ProductionCard as Card } from "@/lib/catalogue/types";
import { pageMetadata } from "@/lib/metadata";

/**
 * Rendered per request on purpose: the list depends on the query string, and inside
 * <Suspense> it would stream as a hidden template that never appears without JavaScript.
 * The data itself comes from the hour-long catalogue cache, so this stays cheap.
 */
export const instant = false;

export async function generateMetadata() {
  const { locale, t } = await getDictionary();
  // A page in the layout's own segment doesn't get the title template, so it names Aitio itself.
  return pageMetadata({ locale, title: t.site.homeTitle, description: t.site.description, absoluteTitle: true });
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
  const options = filterOptions(cards, asOf);
  const filters = parseFilters(params, options);
  const when = effectiveWhen(filters, options);
  const shown = applyFilters(cards, { ...filters, when }, asOf);
  // The openings strip keeps its two weeks whatever range the list shows.
  const premieres = premieresSoon(applyFilters(cards, { ...filters, when: undefined }, asOf), asOf);
  const closing = shown.filter((card) => card.closingSoon).length;
  const days = groupByDay(shown, asOf);
  const dayName = (day: Day) =>
    day.relative === "today"
      ? t.home.today
      : day.relative === "tomorrow"
        ? t.home.tomorrow
        : formatDayHeading(day.sample, locale);

  return (
    <div className="space-y-4">
      {/* Says what the list covers, so it follows the chip rather than a fixed two weeks. */}
      <p className="max-w-measure text-ink-muted">{t.home.intro[when]}</p>
      <WhenChips options={options} filters={filters} locale={locale} t={t} />
      <FilterBar options={options} filters={filters} locale={locale} t={t} />

      {premieres.length > 0 && <Premieres cards={premieres} asOf={asOf} locale={locale} t={t} />}

      <section aria-labelledby="all" className="ai-section">
        <div className="ai-section__head">
          <h2 id="all" className="ai-section__title" aria-live="polite">
            {t.home.count(shown.length)}
          </h2>
          <p className="ai-section__aside">{t.home.byDay}</p>
        </div>
        {closing > 0 && (
          <p className="text-meta">
            {t.home.closingCount(closing)}{" "}
            <Link href={`${href(locale, "asetukset")}#kooste`} className="inline-flex min-h-tap items-center">
              {t.digest.homeLink}
            </Link>
          </p>
        )}
        {shown.length === 0 ? (
          <p className="py-6">{t.home.empty}</p>
        ) : (
          days.map((day) => (
            <section key={day.date} aria-labelledby={`day-${day.date}`} className="mt-6">
              <h3 id={`day-${day.date}`} className="border-b-2 border-ink pb-1 font-sans text-body font-bold">
                {dayName(day)}
                {day.relative && (
                  <span className="font-normal text-ink-muted"> · {formatShortDate(day.sample, locale, asOf)}</span>
                )}
              </h3>
              <ul className="md:grid md:grid-cols-2 md:gap-x-10">
                {day.cards.map((card) => (
                  <ProductionCard key={card.slug} card={card} asOf={asOf} locale={locale} t={t} when="time" heading="h4" />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
}

const PREMIERES_SHOWN = 4;

function PremiereRow({ card, asOf, locale }: { card: Card; asOf: Date; locale: Locale }) {
  return (
    <li className="flex gap-3 border-b border-rule py-3">
      <span className="w-24 shrink-0 font-bold">{card.premiere && formatShortDate(card.premiere, locale, asOf)}</span>
      <span className="min-w-0">
        <Link
          href={href(locale, "esitys", card.slug)}
          className="font-serif text-card break-words text-ink decoration-rule-strong hover:text-ink hover:decoration-current"
        >
          {card.title}
        </Link>
        <span className="block text-meta text-ink-muted">{card.theatre.name}</span>
      </span>
    </li>
  );
}

/**
 * The openings in the window, above the programme (each show is in it too). Four at
 * most before a "more" toggle, so on a phone the programme still starts on the first screen.
 */
function Premieres({ cards, asOf, locale, t }: { cards: Card[]; asOf: Date; locale: Locale; t: Dictionary }) {
  const rest = cards.slice(PREMIERES_SHOWN);
  return (
    <section aria-labelledby="premieres" className="ai-section">
      <div className="ai-section__head">
        <h2 id="premieres" className="ai-section__title">
          {t.home.premieres}
        </h2>
        <p className="ai-section__aside">{t.home.premieresAside}</p>
      </div>
      <ul className="md:grid md:grid-cols-2 md:gap-x-10">
        {cards.slice(0, PREMIERES_SHOWN).map((card) => (
          <PremiereRow key={card.slug} card={card} asOf={asOf} locale={locale} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-tap cursor-pointer list-none items-center font-bold text-accent group-open:hidden [&::-webkit-details-marker]:hidden">
            {t.home.morePremieres(rest.length)}
          </summary>
          <ul className="md:grid md:grid-cols-2 md:gap-x-10">
            {rest.map((card) => (
              <PremiereRow key={card.slug} card={card} asOf={asOf} locale={locale} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/[locale]">) {
  const { locale, t } = await getDictionary();
  return (
    <div className="ai-wide space-y-6">
      <header className="max-w-measure">
        <h1 className="text-display">{t.home.title}</h1>
      </header>
      <OnStage searchParams={searchParams} locale={locale} t={t} />
    </div>
  );
}
