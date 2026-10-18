import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/Notice";
import { ProductionList } from "@/components/ProductionCard";
import { Section } from "@/components/Section";
import { t } from "@/i18n/fi";
import { getTheatre } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/teatteri/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTheatre(slug);
  if (!result.ok || !result.data) return {};
  return {
    title: result.data.name,
    description: `${result.data.name}, ${result.data.city}: mitä on ohjelmassa nyt.`,
    alternates: { canonical: `/teatteri/${slug}` },
  };
}

async function TheatreView({ params }: Pick<PageProps<"/teatteri/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getTheatre(slug);
  if (!result.ok) return <Notice>{t.site.unavailable}</Notice>;
  const theatre = result.data;
  if (!theatre) notFound();

  return (
    <>
      <h1 className="text-display">{theatre.name}</h1>
      <p className="mt-2 text-ink-muted">
        {theatre.city} · <a href={theatre.website}>{t.theatre.website} ↗</a>
      </p>
      <Section title={t.theatre.current} aside={t.programme.count(theatre.productions.length)}>
        {theatre.productions.length > 0 ? (
          <ProductionList items={theatre.productions} now={result.asOf} showTheatre={false} />
        ) : (
          <Notice>{t.theatre.none}</Notice>
        )}
      </Section>
      {theatre.stages.length > 0 && (
        <Section title={t.theatre.stages}>
          <p>{theatre.stages.join(" · ")}</p>
        </Section>
      )}
    </>
  );
}

export default function TheatrePage({ params }: PageProps<"/teatteri/[slug]">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.site.loading}</p>}>
      <TheatreView params={params} />
    </Suspense>
  );
}
