import { notFound } from "next/navigation";
import { Badge, BadgeRow } from "@/components/Badge";
import { ExternalLink } from "@/components/ExternalLink";
import { AudienceSection } from "@/components/production/AudienceSection";
import { CreditList } from "@/components/production/CreditList";
import { CriticLinks } from "@/components/production/CriticLinks";
import { PerformanceList } from "@/components/production/PerformanceList";
import { PosterBlock } from "@/components/production/PosterBlock";
import { RunProgress } from "@/components/production/RunProgress";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { getAllSlugs, getProduction, type ProductionPage } from "@/lib/catalogue/queries";
import { withPlaceholder } from "@/lib/static-params";
import { formatPerformance } from "@/lib/format";
import { productionJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl } from "@/lib/site";

/**
 * Fully static: a slug the build didn't know waits for its complete render instead of
 * getting the fallback shell, so an unknown slug is a real HTTP 404, not a 200.
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { productions } = await getAllSlugs();
  return withPlaceholder(productions.map(({ slug }) => ({ slug })));
}

function describe(page: ProductionPage, locale: Locale, t: Dictionary): string {
  const where = [page.theatre.name, page.stage].filter(Boolean).join(", ");
  const when = page.next
    ? `${t.production.nextPerformance}: ${formatPerformance(page.next, locale, page.asOf)}.`
    : page.year
      ? `${t.production.performedIn(page.year)}.`
      : "";
  return `${t.types[page.type]} · ${where}. ${when}`.trim();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/esitys/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getProduction(slug);
  if (!page) return {};
  return pageMetadata({
    locale,
    section: "esitys",
    slug,
    title: `${page.title} – ${page.theatre.name}`,
    description: describe(page, locale, t),
  });
}

function languageList(codes: string[], t: Dictionary): string {
  return codes.map((code) => t.languages[code] ?? code.toUpperCase()).join(", ");
}

export default async function ProductionRoute({ params }: PageProps<"/[locale]/esitys/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getProduction(slug);
  if (!page) notFound();

  const kicker = page.year ? `${t.types[page.type]} · ${t.production.performedIn(page.year)}` : t.types[page.type];
  const jsonLd = productionJsonLd(page, absoluteUrl(href(locale, "esitys", slug)));

  return (
    <article className="space-y-10">
      <header className="space-y-5">
        <PosterBlock slug={page.slug} title={page.title} theatre={page.theatre.name} stage={page.stage} kicker={kicker} />
        <BadgeRow>
          {page.durationText && <Badge label={t.production.duration}>{page.durationText}</Badge>}
          {page.languages.length > 0 && <Badge label={t.production.language}>{languageList(page.languages, t)}</Badge>}
          {page.subtitleLangs.length > 0 && (
            <Badge label={t.production.subtitles}>{languageList(page.subtitleLangs, t)}</Badge>
          )}
        </BadgeRow>
        <p>
          <Link href={href(locale, "teatteri", page.theatre.slug)} className="text-lg">
            {page.theatre.name}
          </Link>
          {page.stage && <span className="text-ink-muted"> · {page.stage}</span>}
        </p>
      </header>

      <RunProgress
        progress={page.progress}
        premiere={page.premiereDate}
        last={page.last}
        next={page.next}
        asOf={page.asOf}
        locale={locale}
        t={t}
      />

      {page.next && page.ticketUrl && (
        <ExternalLink
          href={page.ticketUrl}
          hint={t.production.externalLink}
          className="flex min-h-tap w-full items-center justify-center rounded border-2 border-accent px-6 text-lg font-semibold text-accent no-underline sm:w-auto sm:inline-flex"
        >
          {t.production.buyTickets}
        </ExternalLink>
      )}

      <PerformanceList rows={page.performances} asOf={page.asOf} locale={locale} t={t} />
      <AudienceSection ratings={page.ratings} tags={page.tags} locale={locale} t={t} />
      <CriticLinks critics={page.critics} locale={locale} t={t} />
      <CreditList credits={page.credits} locale={locale} t={t} />

      <p className="text-base text-ink-muted">
        {t.production.source}:{" "}
        <ExternalLink href={page.sourceUrl} hint={t.production.externalLink}>
          {page.theatre.name}
        </ExternalLink>
      </p>

      {jsonLd.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}
    </article>
  );
}
