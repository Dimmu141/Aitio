import type { RawProduction } from "./types";

/**
 * Follow a paginated listing until there is no next page, a page adds nothing new
 * (Espoon Teatteri's page/2 repeats page 1 yet still links a page 3), or `maxPages`.
 */
export async function collectPages(
  firstUrl: string,
  fetchPage: (url: string) => Promise<string>,
  parse: (html: string) => RawProduction[],
  nextPage: (html: string) => string | null,
  maxPages = 10,
): Promise<RawProduction[]> {
  const all = new Map<string, RawProduction>();
  let url: string | null = firstUrl;
  for (let page = 0; url && page < maxPages; page += 1) {
    const html = await fetchPage(url);
    const before = all.size;
    for (const production of parse(html)) all.set(production.externalId, production);
    url = all.size > before ? nextPage(html) : null;
  }
  return [...all.values()];
}
