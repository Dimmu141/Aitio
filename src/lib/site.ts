/** Public origin for canonical URLs, sitemap and OpenGraph. Set SITE_URL in production. */
export const SITE_URL = new URL(process.env.SITE_URL ?? "http://localhost:3000");

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}
