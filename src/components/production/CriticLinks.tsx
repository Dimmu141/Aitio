import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ReviewLink } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";
import { Section } from "./Section";

function LinkList({ links, locale, t }: { links: ReviewLink[]; locale: Locale; t: Dictionary }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.url} className="ai-critic">
          <a href={link.url} rel="noopener external">
            <span>
              <span className="ai-critic__outlet">{link.outlet}</span>
              {link.publishedAt && <span className="ai-critic__meta">{formatDate(link.publishedAt, locale)}</span>}
              <span className="sr-only"> ({t.production.externalLink})</span>
            </span>
            <span className="ai-critic__arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Outbound links only: we never store or show review text, and never compute a critic
 * score. Press and blogs are kept apart so a blog post isn't read as a newspaper review.
 * Empty sections are left out rather than apologised for.
 */
export function CriticLinks({
  critics,
  blogs,
  locale,
  t,
}: {
  critics: ReviewLink[];
  blogs: ReviewLink[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <>
      {critics.length > 0 && (
        <Section id="critics" title={t.production.critics} aside={t.production.criticsAside}>
          <LinkList links={critics} locale={locale} t={t} />
        </Section>
      )}
      {blogs.length > 0 && (
        <Section id="blogs" title={t.production.blogs} aside={t.production.criticsAside}>
          <LinkList links={blogs} locale={locale} t={t} />
        </Section>
      )}
    </>
  );
}
