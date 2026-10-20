import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { LOCALES, type Section } from "@/i18n/config";
import { alternates } from "@/i18n/paths";
import { getAllSlugs } from "@/lib/catalogue/queries";
import { MIN_PRODUCTIONS_TO_INDEX } from "@/lib/catalogue/select";
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
  // Built per request (its data stays cached under the catalogue tag): prerendered, the file
  // kept serving 19 Oct's lastmod dates after the next day's scrapes.
  await connection();
  const { productions, theatres, people } = await getAllSlugs();
  return [
    ...entries(undefined, undefined),
    ...entries("tietosuoja", undefined),
    ...entries("tietoa", undefined),
    ...productions.flatMap(({ slug, updatedAt }) => entries("esitys", slug, updatedAt)),
    ...theatres.flatMap(({ slug, updatedAt }) => entries("teatteri", slug, updatedAt)),
    ...people
      .filter(({ productions }) => productions >= MIN_PRODUCTIONS_TO_INDEX)
      .flatMap(({ slug }) => entries("henkilo", slug)),
  ];
}
