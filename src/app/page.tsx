import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { Notice } from "@/components/Notice";
import { ProductionList } from "@/components/ProductionCard";
import { Section } from "@/components/Section";
import { t } from "@/i18n/fi";
import { applyFilters, parseFilters } from "@/lib/filters";
import { getProgramme } from "@/lib/queries";

export const metadata = { alternates: { canonical: "/" } };

async function Programme({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const programme = await getProgramme();
  if (!programme.ok) return <Notice>{t.site.unavailable}</Notice>;

  const cities = [...new Set(programme.data.map((item) => item.theatre.city))].sort();
  const filters = parseFilters(params, cities);
  const items = applyFilters(programme.data, filters);
  const closing = items.filter((item) => item.status.phase === "closing");
  const now = programme.asOf;

  return (
    <>
      <FilterBar filters={filters} cities={cities} />
      {items.length === 0 ? (
        <div className="mt-6">
          <Notice>{t.programme.empty}</Notice>
        </div>
      ) : (
        <>
          {closing.length > 0 && (
            <Section title={t.programme.closing} aside={t.programme.count(closing.length)}>
              <p className="mb-2 text-ink-muted">{t.programme.closingLead}</p>
              <ProductionList items={closing} now={now} />
            </Section>
          )}
          <Section title={t.programme.all} aside={t.programme.count(items.length)}>
            <ProductionList items={items} now={now} />
          </Section>
        </>
      )}
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="text-display">{t.programme.title}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t.programme.lead}</p>
      <Suspense fallback={<p className="text-ink-muted">{t.site.loading}</p>}>
        <Programme searchParams={searchParams} />
      </Suspense>
    </>
  );
}
