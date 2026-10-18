import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [{ url: `${base}/` }, { url: `${base}/teatterit` }];
  const result = await getSitemapData();
  if (!result.ok) return pages;
  return [
    ...pages,
    ...result.data.productions.map((production) => ({ url: `${base}/esitys/${production.slug}`, lastModified: production.updatedAt })),
    ...result.data.theatres.map((theatre) => ({ url: `${base}/teatteri/${theatre.slug}`, lastModified: theatre.updatedAt })),
    ...result.data.people.map((person) => ({ url: `${base}/henkilo/${person.slug}` })),
  ];
}
