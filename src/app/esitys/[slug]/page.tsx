import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeRow } from "@/components/Badge";
import { CreditList } from "@/components/CreditList";
import { CriticLinks } from "@/components/CriticLinks";
import { JsonLd } from "@/components/JsonLd";
import { Notice } from "@/components/Notice";
import { PerformanceList } from "@/components/PerformanceList";
import { Poster } from "@/components/Poster";
import { RunProgress } from "@/components/RunProgress";
import { Section } from "@/components/Section";
import { t } from "@/i18n/fi";
import { formatDay } from "@/lib/format";
import { getProduction, type ProductionDetail } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/esitys/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProduction(slug);
  if (!result.ok || !result.data) return {};
  const { title, theatre, stage } = result.data;
  const description = `${title}: ${[theatre.name, stage].filter(Boolean).join(", ")}. Esityspäivät, liput, tekijät ja kriitikoiden arviot.`;
  return {
    title: `${title} – ${theatre.name}`,
    description,
    alternates: { canonical: `/esitys/${slug}` },
    openGraph: { title, description, url: `/esitys/${slug}` },
  };
}

function byline(production: ProductionDetail): string | undefined {
  const writer = production.credits.find((credit) => credit.role === "WRITER")?.person.name;
  const director = production.credits.find((credit) => credit.role === "DIRECTOR")?.person.name;
  const parts = [writer, director ? `${t.role.DIRECTOR.toLowerCase()} ${director}` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function structuredData(production: ProductionDetail): Record<string, unknown> {
  const url = `${siteUrl()}/esitys/${production.slug}`;
  const location = { "@type": "PerformingArtsTheater", name: production.theatre.name, address: production.theatre.city };
  return {
    "@context": "https://schema.org",
    "@graph": production.performances.slice(0, 20).map((performance) => ({
      "@type": "TheaterEvent",
      name: production.title,
      url,
      startDate: performance.startsAt.toISOString(),
      eventStatus: "https://schema.org/EventScheduled",
      location: { ...location, name: performance.stage ? `${production.theatre.name}, ${performance.stage}` : production.theatre.name },
      inLanguage: production.languages,
      ...(performance.ticketUrl ? { offers: { "@type": "Offer", url: performance.ticketUrl } } : {}),
    })),
  };
}

async function ProductionView({ params }: Pick<PageProps<"/esitys/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getProduction(slug);
  if (!result.ok) return <Notice>{t.site.unavailable}</Notice>;
  const production = result.data;
  if (!production) notFound();
  const now = result.asOf;

  return (
    <article>
      <JsonLd data={structuredData(production)} />
      <Poster slug={production.slug} title={production.title} kicker={production.theatre.name} byline={byline(production)} />
      <p className="my-3 text-meta text-ink-muted">
        <a href={`/teatteri/${production.theatre.slug}`} className="font-bold text-ink">
          {production.theatre.name}
        </a>
        {[production.stage, production.durationText].filter(Boolean).map((part) => ` · ${part}`)}
      </p>
      <BadgeRow
        type={production.type}
        languages={production.languages}
        subtitleLangs={production.subtitleLangs}
        closing={production.status.phase === "closing"}
      />
      <div className="mt-6">
        <RunProgress status={production.status} now={now} />
      </div>

      <Section title={t.production.upcoming}>
        <PerformanceList performances={production.performances} mainStage={production.stage} now={now} />
      </Section>

      {production.criticReviews.length > 0 && (
        <Section title={t.production.critics} aside={t.production.criticsAside}>
          <CriticLinks reviews={production.criticReviews} now={now} />
        </Section>
      )}

      {production.credits.length > 0 && (
        <Section title={t.production.credits}>
          <CreditList credits={production.credits} />
        </Section>
      )}

      <p className="mt-8 border-t border-rule pt-4 text-meta text-ink-muted">
        {t.production.source}: <a href={production.sourceUrl}>{new URL(production.sourceUrl).hostname.replace(/^www\./, "")}</a> ·{" "}
        {t.production.updated} {formatDay(production.lastSeenAt, now)}
      </p>
    </article>
  );
}

export default function ProductionPage({ params }: PageProps<"/esitys/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-48 rounded-md bg-paper-sunk" aria-label={t.site.loading} />}>
      <ProductionView params={params} />
    </Suspense>
  );
}
