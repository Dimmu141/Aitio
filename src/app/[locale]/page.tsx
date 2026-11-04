import { getDictionary } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { HomeBody } from "@/components/home/OnStage";

/**
 * The front page with a query string (filters, time chips), rendered per request: inside
 * <Suspense> it would stream as a hidden template that never appears without JavaScript.
 * Without a query string src/proxy.ts serves the prerendered twin in ./ohjelma instead,
 * because rendering the full list per request was a third of Aitio's Fluid CPU.
 */
export const instant = false;

export async function generateMetadata() {
  const { locale, t } = await getDictionary();
  // A page in the layout's own segment doesn't get the title template, so it names Aitio itself.
  return pageMetadata({ locale, title: t.site.homeTitle, description: t.site.description, absoluteTitle: true });
}

export default async function HomePage({ searchParams }: PageProps<"/[locale]">) {
  return <HomeBody params={await searchParams} />;
}
