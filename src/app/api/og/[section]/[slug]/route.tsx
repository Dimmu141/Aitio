import { dictionaryFor } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { posterFoot } from "@/lib/catalogue/credits";
import { getPerson, getProduction, getTheatre } from "@/lib/catalogue/queries";
import { type Card, cardImage } from "@/lib/og/image";

/** "A · B · C": a few titles say more about a theatre or a person than a count. */
function titles(list: Array<{ title: string }>): string | null {
  return list.length > 0 ? list.slice(0, 3).map((item) => item.title).join(" · ") : null;
}

async function card(section: string, slug: string, t: Dictionary): Promise<Card | null> {
  if (section === "esitys") {
    const page = await getProduction(slug);
    return page && { kicker: page.theatre.name, title: page.title, foot: posterFoot(page.credits, t.production), theatreSlug: page.theatre.slug };
  }
  if (section === "teatteri") {
    const page = await getTheatre(slug);
    return page && { kicker: page.theatre.city, title: page.theatre.name, foot: titles([...page.current, ...page.upcoming]), theatreSlug: page.theatre.slug };
  }
  if (section === "henkilo") {
    const page = await getPerson(slug);
    return page && { kicker: t.site.name, title: page.name, foot: titles([...page.current, ...page.upcoming, ...page.past].map((entry) => entry.card)) };
  }
  return null;
}

/**
 * Share images for production, theatre and person pages, at /api/og/<section>/<slug>?l=<locale>.
 * Under /api so the locale proxy never redirects a link-preview crawler on the way.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/og/[section]/[slug]">): Promise<Response> {
  const { section, slug } = await params;
  const requested = new URL(request.url).searchParams.get("l") ?? "fi";
  const locale: Locale = isLocale(requested) ? requested : "fi";
  const found = await card(section, slug, dictionaryFor(locale));
  return found ? cardImage(found) : new Response("Not found", { status: 404 });
}
