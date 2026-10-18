import Link from "next/link";
import { Stars } from "@/components/Stars";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import type { PublicReview } from "@/lib/catalogue/queries";
import { formatCalendarDate } from "@/lib/format";

export function ReviewList({ reviews, locale, t }: { reviews: PublicReview[]; locale: Locale; t: Dictionary }) {
  if (reviews.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xl font-semibold">{t.reviews.title}</h3>
      <ul>
        {reviews.map((review) => (
          <li key={review.id} className="space-y-1 border-b border-rule py-3">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{review.name || t.reviews.anonymous}</span>
              {review.rating !== null && <Stars halfStars={review.rating} label={t.stars(review.rating)} />}
              <span className="text-base text-ink-muted">{formatCalendarDate(review.seenOn, locale)}</span>
            </p>
            <p className="whitespace-pre-line break-words">{review.text}</p>
            <Link
              href={href(locale, "ilmoita", review.id)}
              rel="nofollow"
              className="inline-flex min-h-[2.75rem] items-center text-base text-ink-muted"
            >
              {t.report.link}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
