import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ReviewLink } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";
import { Section } from "./Section";

/** "Maria Säkö · 12.10.2026 · maksumuuri": who wrote it tells two links to one paper apart. */
function meta(link: ReviewLink, locale: Locale, t: Dictionary): string {
  return [link.critic, link.publishedAt && formatDate(link.publishedAt, locale), link.paywalled && t.production.paywall]
    .filter(Boolean)
    .join(" · ");
}

function LinkList({ links, locale, t }: { links: ReviewLink[]; locale: Locale; t: Dictionary }) {
  return (
    <ul>
      {links.map((link) => {
        const details = meta(link, locale, t);
        return (
          <li key={link.url} className="ai-critic">
            <a href={link.url} rel="noopener external">
              <span>
                <span className="ai-critic__outlet">{link.outlet}</span>
                {details && <span className="ai-critic__meta">{details}</span>}
                <span className="sr-only"> ({t.production.externalLink})</span>
              </span>
              <span className="ai-critic__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Outbound links only: we never store or show review text, and never compute a critic
 * score. Press, blogs and features are kept apart so a blog post or an interview isn't
 * read as a newspaper review.
 * Empty sections are left out rather than apologised for.
 */
export function CriticLinks({
  critics,
  blogs,
  features,
  locale,
  t,
}: {
  critics: ReviewLink[];
  blogs: ReviewLink[];
  features: ReviewLink[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <>
      {critics.length > 0 && (
        <Section
          id="critics"
          title={t.production.critics}
          aside={t.production.criticsAside}
        >
          <LinkList links={critics} locale={locale} t={t} />
        </Section>
      )}
      {blogs.length > 0 && (
        <Section
          id="blogs"
          title={t.production.blogs}
          aside={t.production.criticsAside}
        >
          <LinkList links={blogs} locale={locale} t={t} />
        </Section>
      )}
      {features.length > 0 && (
        <Section
          id="features"
          title={t.production.features}
          aside={t.production.criticsAside}
        >
          <LinkList links={features} locale={locale} t={t} />
        </Section>
      )}
    </>
  );
}
