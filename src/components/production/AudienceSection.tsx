import { starText } from "@/components/Stars";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ProductionPage } from "@/lib/catalogue/queries";
import { MIN_RATINGS_FOR_AVERAGE, MIN_RATINGS_FOR_HISTOGRAM } from "@/lib/catalogue/select";
import { ReviewList } from "./ReviewList";
import { Section } from "./Section";

/**
 * What the audience thinks, revealed in steps: the count and tags first, the histogram
 * from five ratings, the average from ten.
 */
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
  // Highest first, like the specimen; empty half-star rows are left out.
  const rows = ratings.buckets
    .map((count, index) => ({ halfStars: index + 1, count }))
    .filter((row) => row.count > 0)
    .reverse();
  return (
    <Section id="audience" title={t.production.audience}>
      {ratings.count === 0 ? (
        <p className="text-ink-muted">{t.production.noRatings}</p>
      ) : (
        <p className="ai-score">
          <span className="ai-score__num">
            {ratings.average !== null
              ? ratings.average.toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : ratings.count}
          </span>
          <span className="ai-score__note">
            {ratings.average !== null
              ? t.production.ratingsCount(ratings.count)
              : `${t.production.ratingsNoun(ratings.count)} · ${t.production.averageHidden(MIN_RATINGS_FOR_AVERAGE)}`}
          </span>
        </p>
      )}
      {tags.length > 0 && (
        <ul className="ai-tags mb-6">
          {tags.map((tag) => (
            <li key={tag.slug} className="ai-tag">
              {tag.labels[locale]} <span className="ai-tag__n">{tag.count}</span>
            </li>
          ))}
        </ul>
      )}
      {ratings.count >= MIN_RATINGS_FOR_HISTOGRAM && (
        <dl aria-label={t.production.histogramLabel} className="ai-hist mb-6">
          {rows.map((row) => (
            <div key={row.halfStars} className="contents">
              <dt className="ai-hist__label">
                <span aria-hidden="true">{starText(row.halfStars)}</span>
                <span className="sr-only">{t.production.stars(row.halfStars / 2)}</span>
              </dt>
              <dd className="ai-hist__track" aria-hidden="true">
                <div className="ai-hist__bar" style={{ width: `${(row.count / max) * 100}%` }} />
              </dd>
              <dd className="ai-hist__n">{row.count}</dd>
            </div>
          ))}
        </dl>
      )}
      <ReviewList reviews={reviews} locale={locale} t={t} />
    </Section>
  );
}
