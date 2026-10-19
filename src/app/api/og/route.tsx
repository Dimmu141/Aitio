import { dictionaryFor } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { cardImage } from "@/lib/og/image";

/** The share image for every page without its own: the front page, about, search. */
export async function GET(request: Request): Promise<Response> {
  const requested = new URL(request.url).searchParams.get("l") ?? "fi";
  const t = dictionaryFor(isLocale(requested) ? requested : "fi");
  return cardImage({ kicker: t.site.name, title: t.site.tagline, foot: null });
}
