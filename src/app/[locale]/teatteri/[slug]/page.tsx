import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import { getAllSlugs, getTheatre } from "@/lib/catalogue/queries";
import type { ProductionCard as CardData } from "@/lib/catalogue/types";
import { pageMetadata } from "@/lib/metadata";
import { theatreTone } from "@/lib/poster";
import { withPlaceholder } from "@/lib/static-params";

/** Fully static, so an unknown slug is a real 404 (see the production page). */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { theatres } = await getAllSlugs();
  return withPlaceholder(theatres.map(({ slug }) => ({ slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/teatteri/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getTheatre(slug);
  if (!page) return {};
  const titles = page.current.slice(0, 4).map((card) => card.title);
  return pageMetadata({
    locale,
    section: "teatteri",
    slug,
    title: page.theatre.name,
    description: `${page.theatre.name}, ${page.theatre.city}. ${t.theatre.current}: ${titles.join(", ") || "–"}.`,
  });
}

export default async function TheatreRoute({ params }: PageProps<"/[locale]/teatteri/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getTheatre(slug);
  if (!page) notFound();

  const cardList = (cards: CardData[]) => (
    <ul>
      {cards.map((card) => (
        <ProductionCard key={card.slug} card={card} asOf={page.asOf} locale={locale} t={t} showTheatre={false} />
      ))}
    </ul>
  );

  return (
    <div className="space-y-10">
      <header className="space-y-2 border-b-4 border-double border-ink pb-4">
        <span aria-hidden="true" className={`ai-poster--${theatreTone(page.theatre.slug).name} block h-2 w-16 rounded-sm`} />
        <p className="text-label font-bold uppercase tracking-[0.06em] text-ink-muted">{page.theatre.city}</p>
        <h1 className="text-display">{page.theatre.name}</h1>
        <p>
          <ExternalLink href={page.theatre.website} hint={t.production.externalLink} className="inline-flex min-h-tap items-center">
            {t.theatre.website}
          </ExternalLink>
        </p>
      </header>

      <section aria-labelledby="current">
        <h2 id="current" className="text-section">
          {t.theatre.current}
        </h2>
        {page.current.length === 0 ? (
          <p className="py-4 text-ink-muted">{t.theatre.noCurrent}</p>
        ) : (
          cardList(page.current)
        )}
      </section>

      {page.stages.length > 0 && (
        <section aria-labelledby="stages">
          <h2 id="stages" className="text-section">
            {t.theatre.stages}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {page.stages.map((stage) => (
              <li key={stage} className="rounded-md border border-rule bg-paper-raised px-3 py-1">
                {stage}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.upcoming.length > 0 && (
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="text-section">
            {t.theatre.upcoming}
          </h2>
          {cardList(page.upcoming)}
        </section>
      )}

      {page.past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="text-section">
            {t.theatre.past}
          </h2>
          {cardList(page.past)}
        </section>
      )}

      {page.archive.length > 0 && (
        <details className="group border-t border-rule pt-4">
          <summary className="flex min-h-tap cursor-pointer items-center font-bold">{t.theatre.archive(page.archive.length)}</summary>
          {cardList(page.archive)}
        </details>
      )}
    </div>
  );
}
