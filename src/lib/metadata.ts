import type { Metadata } from "next";
import type { Locale, Section } from "@/i18n/config";
import { INTL_LOCALE } from "@/i18n/config";
import { alternates, href } from "@/i18n/paths";

/** Canonical, hreflang alternates and OpenGraph for one page in one locale. */
export function pageMetadata({
  locale,
  section,
  slug,
  title,
  description,
}: {
  locale: Locale;
  section?: Section;
  slug?: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = href(locale, section, slug);
  return {
    title,
    description,
    alternates: { canonical, languages: { ...alternates(section, slug), "x-default": href("fi", section, slug) } },
    openGraph: {
      type: "website",
      siteName: "Aitio",
      title,
      description,
      url: canonical,
      locale: INTL_LOCALE[locale].replace("-", "_"),
    },
  };
}
