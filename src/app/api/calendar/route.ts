import type { NextRequest } from "next/server";
import { dictionaryFor } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { parseDuration } from "@/lib/catalogue/duration";
import { isCurrent } from "@/lib/catalogue/select";
import { db } from "@/lib/db";
import { performanceIcs } from "@/lib/ics";
import { absoluteUrl } from "@/lib/site";

/**
 * One performance as an .ics file: /api/calendar?show=<slug>&at=<ISO time>&lang=fi.
 * The links sit on static pages, so the file is built here, per request, from current data.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const slug = params.get("show") ?? "";
  const at = new Date(params.get("at") ?? "");
  const lang = params.get("lang") ?? "";
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  if (!slug || Number.isNaN(at.getTime())) return new Response("Bad request", { status: 400 });

  const production = await db.production.findUnique({
    where: { slug },
    select: {
      title: true,
      lastSeenAt: true,
      durationText: true,
      ticketUrl: true,
      theatre: { select: { name: true } },
      stage: { select: { name: true } },
      performances: {
        where: { startsAt: at },
        select: { startsAt: true, lastSeenAt: true, ticketUrl: true, stage: { select: { name: true } } },
      },
    },
  });
  const performance = production?.performances.find((row) => isCurrent(row, production));
  if (!production || !performance) return new Response("Not found", { status: 404 });

  const t = dictionaryFor(locale);
  const page = absoluteUrl(href(locale, "esitys", slug));
  const stage = performance.stage?.name ?? production.stage?.name;
  const tickets = performance.ticketUrl ?? production.ticketUrl;
  const body = performanceIcs({
    uid: `${slug}-${Math.floor(at.getTime() / 1000)}@omaaitio.fi`,
    start: performance.startsAt,
    minutes: parseDuration(production.durationText)?.minutes ?? null,
    title: production.title,
    location: [production.theatre.name, stage !== production.theatre.name ? stage : null].filter(Boolean).join(", "),
    url: page,
    description: [tickets ? `${t.production.performanceTickets}: ${tickets}` : null, page].filter(Boolean).join("\n"),
    stamp: new Date(),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${performance.startsAt.toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
