import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import { getAllSlugs, getTheatre } from "@/lib/catalogue/queries";
import { pageMetadata } from "@/lib/metadata";
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

  return (
    <div className="space-y-10">
      <header className="space-y-2 border-b-4 border-double border-ink pb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">{page.theatre.city}</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">{page.theatre.name}</h1>
        <p>
          <ExternalLink href={page.theatre.website} hint={t.production.externalLink} className="inline-flex min-h-tap items-center">
            {t.theatre.website}
          </ExternalLink>
        </p>
      </header>

      <section aria-labelledby="current">
        <h2 id="current" className="text-3xl font-semibold">
          {t.theatre.current}
        </h2>
        {page.current.length === 0 ? (
          <p className="py-4 text-ink-muted">{t.theatre.noCurrent}</p>
        ) : (
          <ul>
            {page.current.map((card) => (
              <ProductionCard key={card.slug} card={card} asOf={page.asOf} locale={locale} t={t} showTheatre={false} />
            ))}
          </ul>
        )}
      </section>

      {page.stages.length > 0 && (
        <section aria-labelledby="stages">
          <h2 id="stages" className="text-2xl font-semibold">
            {t.theatre.stages}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {page.stages.map((stage) => (
              <li key={stage} className="rounded border border-rule bg-card px-3 py-1">
                {stage}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="text-2xl font-semibold">
            {t.theatre.past}
          </h2>
          <ul>
            {page.past.map((card) => (
              <ProductionCard key={card.slug} card={card} asOf={page.asOf} locale={locale} t={t} showTheatre={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
