import { notFound } from "next/navigation";
import { Badge, BadgeRow } from "@/components/Badge";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { ExternalLink } from "@/components/ExternalLink";
import { AudienceSection } from "@/components/production/AudienceSection";
import { CreditList } from "@/components/production/CreditList";
import { CriticLinks } from "@/components/production/CriticLinks";
import { PerformanceList, subtitleText } from "@/components/production/PerformanceList";
import { PosterBlock } from "@/components/production/PosterBlock";
import { RunProgress } from "@/components/production/RunProgress";
import Link from "next/link";
import { getDictionary } from "@/i18n";
import type { CreditRole } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { getAllSlugs, getProduction, type ProductionPage } from "@/lib/catalogue/queries";
import { withPlaceholder } from "@/lib/static-params";
import { formatPerformance, formatShortDate } from "@/lib/format";
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

function hostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Poster foot like a programme cover: "Writer · ohjaus Director". */
function posterFoot(page: ProductionPage, t: Dictionary): string | null {
  const first = (role: CreditRole) => page.credits.find((credit) => credit.role === role)?.person.name;
  const writer = first("WRITER");
  const director = first("DIRECTOR");
  const parts = [writer, director && `${t.production.directedBy} ${director}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function ProductionRoute({ params }: PageProps<"/[locale]/esitys/[slug]">) {
  const { slug } = await params;
  const { locale, t } = await getDictionary();
  const page = await getProduction(slug);
  if (!page) notFound();

  const jsonLd = productionJsonLd(page, absoluteUrl(href(locale, "esitys", slug)));
  const rowTickets = page.performances.some((row) => row.ticketUrl);

  return (
    <article>
      <header>
        <PosterBlock slug={page.slug} title={page.title} kicker={page.theatre.name} foot={posterFoot(page, t)} />
        <p className="ai-facts">
          <Link href={href(locale, "teatteri", page.theatre.slug)}>{page.theatre.name}</Link>
          {[page.stage, page.durationText].filter(Boolean).map((fact) => ` · ${fact}`)}
        </p>
        <BadgeRow>
          {page.closingSoon && (
            <Badge variant="urgent">
              <span aria-hidden="true">⏳</span> {t.home.closingSoon}
            </Badge>
          )}
          <Badge>{page.year ? `${t.types[page.type]} · ${t.production.performedIn(page.year)}` : t.types[page.type]}</Badge>
          {page.languages.map((code) => (
            <Badge key={code} title={`${t.production.language}: ${t.languages[code] ?? code}`}>
              {code.length === 2 && <span className="ai-badge__code">{code.toUpperCase()}</span>}
              {t.production.spokenIn[code] ?? t.languages[code] ?? code}
            </Badge>
          ))}
          {page.subtitleLangs.length > 0 && (
            <Badge
              title={`${t.production.subtitles}: ${page.subtitleLangs.map((code) => t.languages[code] ?? code).join(", ")}`}
            >
              {subtitleText(page.subtitleLangs, t)}
            </Badge>
          )}
        </BadgeRow>
      </header>

      <div className="mt-6">
        <RunProgress
          progress={page.progress}
          premiere={page.premiereDate}
          last={page.last}
          next={page.next}
          remaining={page.performances.length}
          fullSchedule={page.fullSchedule}
          asOf={page.asOf}
          locale={locale}
          t={t}
        />
      </div>

      <div className="ai-actions mt-6 mb-2">
        <Link href={href(locale, "merkitse", page.slug)} className={buttonPrimary}>
          <span aria-hidden="true">＋</span> {t.log.button}
        </Link>
        {page.next && page.ticketUrl && !rowTickets && (
          <ExternalLink href={page.ticketUrl} hint={t.production.externalLink} className={buttonSecondary}>
            {t.production.buyTickets}
          </ExternalLink>
        )}
      </div>

      <PerformanceList rows={page.performances} asOf={page.asOf} locale={locale} t={t} />
      <AudienceSection ratings={page.ratings} tags={page.tags} reviews={page.reviews} locale={locale} t={t} />
      <CriticLinks critics={page.critics} blogs={page.blogs} locale={locale} t={t} />
      <CreditList credits={page.credits} locale={locale} t={t} />

      <p className="ai-source">
        {t.production.sourceLine}:{" "}
        <ExternalLink href={page.sourceUrl} hint={t.production.externalLink}>
          {hostname(page.sourceUrl)}
        </ExternalLink>{" "}
        · {t.production.updated} {formatShortDate(page.updatedAt, locale, page.asOf, false)}
      </p>

      {jsonLd.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}
    </article>
  );
}
