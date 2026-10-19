/**
 * The crawler's User-Agent. The about page promises theatres that it names us and how to
 * reach us, so without an explicit SCRAPER_USER_AGENT it is built from the same contact
 * address the site shows (PRIVACY_EMAIL) and the about page's URL.
 */
export function userAgent(env: Record<string, string | undefined>): string {
  if (env.SCRAPER_USER_AGENT) return env.SCRAPER_USER_AGENT;
  const about = new URL("/tietoa", env.SITE_URL ?? "https://omaaitio.fi").toString();
  return `AitioBot/1.0 (+${about}${env.PRIVACY_EMAIL ? `; ${env.PRIVACY_EMAIL}` : ""})`;
}
