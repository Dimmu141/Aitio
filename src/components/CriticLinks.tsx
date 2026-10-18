import { formatDay } from "@/lib/format";

type Review = { outlet: string; url: string; publishedAt: Date | null };

/** Outbound links only: never a score, never a quote. */
export function CriticLinks({ reviews, now }: { reviews: Review[]; now: Date }) {
  return (
    <ul>
      {reviews.map((review) => (
        <li key={review.url} className="border-b border-rule">
          <a href={review.url} target="_blank" rel="noopener" className="flex min-h-16 items-center justify-between gap-3 text-ink no-underline">
            <span>
              <span className="block font-bold">{review.outlet}</span>
              {review.publishedAt && <span className="block text-meta text-ink-muted">{formatDay(review.publishedAt, now)}</span>}
            </span>
            <span aria-hidden="true" className="font-bold text-accent">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
