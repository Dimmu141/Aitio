import { ExternalLink } from "@/components/ExternalLink";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { ReviewLink } from "@/lib/catalogue/queries";
import { formatDate } from "@/lib/format";

function LinkList({ links, locale, t }: { links: ReviewLink[]; locale: Locale; t: Dictionary }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.url} className="border-b border-rule">
          <ExternalLink href={link.url} hint={t.production.externalLink} className="flex min-h-tap items-center py-2">
            {link.outlet}
            {link.publishedAt && <span className="text-ink-muted">, {formatDate(link.publishedAt, locale)}</span>}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Outbound links only: we never store or show review text, and never compute a critic
 * score. Press and blogs are kept apart so a blog post isn't read as a newspaper review.
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
      <section aria-labelledby="critics" className="space-y-2">
        <h2 id="critics" className="text-2xl font-semibold">
          {t.production.critics}
        </h2>
        {critics.length === 0 ? (
          <p className="text-ink-muted">{t.production.noCritics}</p>
        ) : (
          <>
            <p className="text-base text-ink-muted">{t.production.criticsIntro}</p>
            <LinkList links={critics} locale={locale} t={t} />
          </>
        )}
      </section>
      {blogs.length > 0 && (
        <section aria-labelledby="blogs" className="space-y-2">
          <h2 id="blogs" className="text-2xl font-semibold">
            {t.production.blogs}
          </h2>
          <p className="text-base text-ink-muted">{t.production.blogsIntro}</p>
          <LinkList links={blogs} locale={locale} t={t} />
        </section>
      )}
    </>
  );
}
