import { notFound } from "next/navigation";
import { ProductionCard } from "@/components/ProductionCard";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { getAllSlugs, getPerson, type PersonCredit } from "@/lib/catalogue/queries";
import { pageMetadata } from "@/lib/metadata";
import { withPlaceholder } from "@/lib/static-params";

/** Fully static, so an unknown slug is a real 404 (see the production page). */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { people } = await getAllSlugs();
  return withPlaceholder(people.map(({ slug }) => ({ slug })));
}

function roleNote(entry: PersonCredit, t: Dictionary): string {
  const roles = entry.roles.filter((role) => role !== "CAST").map((role) => t.roles[role]);
  const characters = entry.characterNames.map((name) => t.person.as(name));
  const cast = entry.roles.includes("CAST") && characters.length === 0 ? [t.roles.CAST] : [];
  return [...roles, ...cast, ...characters].join(" · ");
}

export async function generateMetadata({ params }: PageProps<"/[locale]/henkilo/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getPerson(slug);
  if (!page) return {};
  const titles = [...page.current, ...page.upcoming, ...page.past].slice(0, 4).map((entry) => entry.card.title);
  return pageMetadata({
    locale,
    section: "henkilo",
    slug,
    title: page.name,
    description: `${page.name}: ${titles.join(", ")}. ${t.site.tagline}.`,
  });
}

export default async function PersonRoute({ params }: PageProps<"/[locale]/henkilo/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getPerson(slug);
  if (!page) notFound();

  const list = (entries: PersonCredit[]) => (
    <ul>
      {entries.map((entry) => (
        <ProductionCard
          key={entry.card.slug}
          card={entry.card}
          asOf={page.asOf}
          locale={locale}
          t={t}
          note={roleNote(entry, t)}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-10">
      <h1 className="border-b-4 border-double border-ink pb-4 text-display">{page.name}</h1>
      {page.current.length > 0 && (
        <section aria-labelledby="current">
          <h2 id="current" className="text-section">
            {t.person.current}
          </h2>
          {list(page.current)}
        </section>
      )}
      {page.upcoming.length > 0 && (
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="text-section">
            {t.person.upcoming}
          </h2>
          {list(page.upcoming)}
        </section>
      )}
      {page.past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="text-section">
            {t.person.past}
          </h2>
          {list(page.past)}
        </section>
      )}
    </div>
  );
}
