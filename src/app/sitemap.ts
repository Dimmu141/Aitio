import type { MetadataRoute } from "next";
import { LOCALES, type Section } from "@/i18n/config";
import { alternates } from "@/i18n/paths";
import { getAllSlugs } from "@/lib/catalogue/queries";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

/** One entry per page and locale, each listing its siblings as hreflang alternates. */
function entries(section: Section | undefined, slug: string | undefined, lastModified?: Date): Entry[] {
  const paths = alternates(section, slug);
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, absoluteUrl(paths[locale])]));
  return LOCALES.map((locale) => ({
    url: absoluteUrl(paths[locale]),
    lastModified,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { productions, theatres, people } = await getAllSlugs();
  return [
    ...entries(undefined, undefined),
    ...entries("tietosuoja", undefined),
    ...productions.flatMap(({ slug, updatedAt }) => entries("esitys", slug, updatedAt)),
    ...theatres.flatMap(({ slug, updatedAt }) => entries("teatteri", slug, updatedAt)),
    ...people.flatMap(({ slug }) => entries("henkilo", slug)),
  ];
}
