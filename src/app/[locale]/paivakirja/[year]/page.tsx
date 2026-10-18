import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MonthChart, monthName } from "@/components/diary/MonthChart";
import { Stars } from "@/components/Stars";
import { getDictionary } from "@/i18n";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { TAGS } from "@/lib/diary/tags";
import { diaryYears, getEntryFacts } from "@/lib/engagement/facts";
import { type YearReview, yearInReview } from "@/lib/engagement/year";
import { formatCalendarDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

/** Personal and per request. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

/** One rating is a rating, not an average. */
const MIN_RATED_FOR_AVERAGE = 2;

const day = (iso: string, locale: Locale) => formatCalendarDate(new Date(`${iso}T00:00:00Z`), locale);

function tagLabel(slug: string, locale: Locale): string {
  const tag = TAGS.find((candidate) => candidate.slug === slug);
  if (!tag) return slug;
  return locale === "sv" ? tag.labelSv : locale === "en" ? tag.labelEn : tag.labelFi;
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded border border-rule bg-card p-3">
      <dd className="font-serif text-5xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-base text-ink-muted">{label}</dt>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-rule pt-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Figures({ review, locale, t }: { review: YearReview; locale: Locale; t: Dictionary }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Figure value={review.shows} label={t.year.shows(review.shows)} />
      <Figure value={review.theatres.length} label={t.year.theatresCount(review.theatres.length)} />
      {review.averageRating !== null && review.rated >= MIN_RATED_FOR_AVERAGE && (
        <Figure value={review.averageRating.toLocaleString(INTL_LOCALE[locale])} label={t.year.average} />
      )}
      {review.reviews > 0 && <Figure value={review.reviews} label={t.year.reviewsCount(review.reviews)} />}
    </dl>
  );
}

function Ranked({ rows }: { rows: Array<{ key: string; label: ReactNode; count: ReactNode }> }) {
  return (
    <ol className="divide-y divide-rule">
      {rows.map((row) => (
        <li key={row.key} className="flex min-h-tap items-center justify-between gap-3 py-2">
          <span className="min-w-0 break-words">{row.label}</span>
          <span className="shrink-0 tabular-nums text-ink-muted">{row.count}</span>
        </li>
      ))}
    </ol>
  );
}

function Review({ review, locale, t }: { review: YearReview; locale: Locale; t: Dictionary }) {
  const production = (ref: { slug: string; title: string }) => <Link href={href(locale, "esitys", ref.slug)}>{ref.title}</Link>;
  return (
    <>
      <Figures review={review} locale={locale} t={t} />
      <p className="text-lg">
        {t.year.productions(review.productions)}
        {review.rewatches > 0 && `, ${t.year.rewatches(review.rewatches)}`}.
      </p>

      <Section id="months" title={t.year.months}>
        <MonthChart months={review.months} locale={locale} t={t} />
        {review.busiestMonth !== null && review.shows > 1 && <p>{t.year.busiest(monthName(review.busiestMonth, locale))}</p>}
      </Section>

      {review.favourites.length > 0 && (
        <Section id="favourites" title={t.year.favourites}>
          <Ranked
            rows={review.favourites.map((favourite) => ({
              key: favourite.slug,
              label: (
                <>
                  {production(favourite)}
                  <span className="block text-base text-ink-muted">{favourite.theatre}</span>
                </>
              ),
              count: <Stars halfStars={favourite.rating} label={t.stars(favourite.rating)} />,
            }))}
          />
        </Section>
      )}

      <Section id="theatres" title={t.year.theatres}>
        <Ranked
          rows={review.theatres.map(({ item, count }) => ({
            key: item.slug,
            label: <Link href={href(locale, "teatteri", item.slug)}>{item.name}</Link>,
            count,
          }))}
        />
      </Section>

      {review.performers.length > 0 && (
        <Section id="performers" title={t.year.performers}>
          <Ranked
            rows={review.performers.map(({ item, count }) => ({
              key: item.slug,
              label: <Link href={href(locale, "henkilo", item.slug)}>{item.name}</Link>,
              count: t.year.performerCount(count),
            }))}
          />
        </Section>
      )}

      {review.tags.length > 0 && (
        <Section id="tags" title={t.year.tags}>
          <Ranked rows={review.tags.map(({ item, count }) => ({ key: item, label: tagLabel(item, locale), count }))} />
        </Section>
      )}

      <Section id="genres" title={t.year.types}>
        <Ranked rows={review.types.map(({ item, count }) => ({ key: item, label: t.types[item], count }))} />
        {review.languages.length > 0 && (
          <p>
            {t.year.languages}: {review.languages.map((code) => t.languages[code] ?? code).join(", ")}
          </p>
        )}
      </Section>

      {review.first && review.last && (
        <dl className="grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
          {[
            { label: t.year.first, ref: review.first },
            { label: t.year.last, ref: review.last },
          ].map(({ label, ref }) => (
            <div key={label}>
              <dt className="text-base text-ink-muted">{label}</dt>
              <dd>
                {production(ref)}, {day(ref.seenOn, locale)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export default async function YearPage({ params }: PageProps<"/[locale]/paivakirja/[year]">) {
  const [{ locale, t }, { year: raw }] = await Promise.all([getDictionary(), params]);
  if (!/^\d{4}$/.test(raw)) notFound();
  const year = Number(raw);
  const user = await requireUser(locale, href(locale, "paivakirja", raw));
  const facts = await getEntryFacts(user.id);
  const review = yearInReview(facts, year);
  const others = diaryYears(facts).filter((other) => other !== year);

  return (
    <div className="space-y-6">
      <header className="border-b-4 border-double border-ink pb-4">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t.year.title(year)}</h1>
        <p className="text-base text-ink-muted">{t.year.privateNote}</p>
      </header>

      {review.shows === 0 ? <p className="text-lg">{t.year.empty(year)}</p> : <Review review={review} locale={locale} t={t} />}

      <nav aria-label={t.year.otherYears} className="flex flex-wrap gap-x-6 border-t border-rule pt-4">
        <Link href={href(locale, "paivakirja")} className="inline-flex min-h-tap items-center">
          {t.year.back}
        </Link>
        {others.map((other) => (
          <Link key={other} href={href(locale, "paivakirja", String(other))} className="inline-flex min-h-tap items-center">
            {t.year.link(other)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
