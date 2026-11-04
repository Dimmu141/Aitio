import { HomeBody } from "@/components/home/OnStage";
import { getDictionary } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

/**
 * The front page without a query string, prerendered and refreshed with the catalogue
 * cache. src/proxy.ts rewrites "/", "/sv" and "/en" here when there is no query string,
 * and answers 404 for this route's own URL, so the page keeps one public address.
 */
export async function generateMetadata() {
  const { locale, t } = await getDictionary();
  // pageMetadata's canonical is the front page's own URL, not this route's.
  return pageMetadata({ locale, title: t.site.homeTitle, description: t.site.description, absoluteTitle: true });
}

export default function StaticHomePage() {
  return <HomeBody params={{}} />;
}
