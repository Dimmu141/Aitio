import type { Metadata } from "next";
import type { Locale, Section } from "@/i18n/config";
import { INTL_LOCALE } from "@/i18n/config";
import { alternates, href } from "@/i18n/paths";
import { OG_SIZE } from "@/lib/og/size";

/** Sections with an image of their own (/api/og/<section>/<slug>); the rest share the site card. */
const IMAGE_SECTIONS: ReadonlySet<Section> = new Set(["esitys", "teatteri", "henkilo"]);

/** The share image's path: under /api, so link-preview crawlers get it without a redirect. */
export function shareImagePath(locale: Locale, section?: Section, slug?: string): string {
  return section && slug && IMAGE_SECTIONS.has(section)
    ? `/api/og/${section}/${encodeURIComponent(slug)}?l=${locale}`
    : `/api/og?l=${locale}`;
}

/** Canonical, hreflang alternates, OpenGraph and the large share card for one page in one locale. */
export function pageMetadata({
  locale,
  section,
  slug,
  title,
  description,
  absoluteTitle = false,
  noindex = false,
}: {
  locale: Locale;
  section?: Section;
  slug?: string;
  title: string;
  description: string;
  /** Skip the layout's "%s · Aitio" template (the front page names Aitio itself). */
  absoluteTitle?: boolean;
  /** Keep a thin page out of search results; its links are still followed. */
  noindex?: boolean;
}): Metadata {
  const canonical = href(locale, section, slug);
  const image = { url: shareImagePath(locale, section, slug), ...OG_SIZE, alt: title };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, languages: { ...alternates(section, slug), "x-default": href("fi", section, slug) } },
    openGraph: {
      type: "website",
      siteName: "Aitio",
      title,
      description,
      url: canonical,
      locale: INTL_LOCALE[locale].replace("-", "_"),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
