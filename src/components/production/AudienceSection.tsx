import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ProductionPage } from "@/lib/catalogue/queries";
import { MIN_RATINGS_FOR_AVERAGE } from "@/lib/catalogue/select";
import { ReviewList } from "./ReviewList";

/** Rating histogram and tag counts. The average stays hidden until it means something. */
export function AudienceSection({
  ratings,
  tags,
  reviews,
  locale,
  t,
}: {
  ratings: ProductionPage["ratings"];
  tags: ProductionPage["tags"];
  reviews: ProductionPage["reviews"];
  locale: Locale;
  t: Dictionary;
}) {
  const max = Math.max(1, ...ratings.buckets);
  return (
    <section aria-labelledby="audience" className="space-y-3">
      <h2 id="audience" className="text-2xl font-semibold">
        {t.production.audience}
      </h2>
      {ratings.count === 0 ? (
        <p className="text-ink-muted">{t.production.noRatings}</p>
      ) : (
        <>
          <p>
            {ratings.average !== null && <span className="mr-3 font-serif text-3xl font-semibold">{ratings.average}</span>}
            {t.production.ratingsCount(ratings.count)}
          </p>
          <ol aria-label={t.production.histogramLabel} className="flex h-24 items-end gap-1">
            {ratings.buckets.map((count, index) => (
              <li
                key={index}
                className="flex-1 rounded-t-sm bg-accent"
                style={{ height: `${Math.max(4, (count / max) * 100)}%`, opacity: count === 0 ? 0.2 : 1 }}
              >
                <span className="sr-only">
                  {t.production.stars((index + 1) / 2)}: {count}
                </span>
              </li>
            ))}
          </ol>
          {ratings.average === null && (
            <p className="text-base text-ink-muted">{t.production.averageHidden(MIN_RATINGS_FOR_AVERAGE)}</p>
          )}
        </>
      )}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.slug} className="rounded-full border border-rule px-3 py-1 text-base">
              {tag.labels[locale]} <span className="text-ink-muted">{tag.count}</span>
            </li>
          ))}
        </ul>
      )}
      <ReviewList reviews={reviews} locale={locale} t={t} />
    </section>
  );
}
