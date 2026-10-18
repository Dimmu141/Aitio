import * as cheerio from "cheerio";
import { z } from "zod";
import { politeFetch } from "../http";
import { collectPages } from "../paginate";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, parseFinnishDate, stripGuestMarker } from "../text";
import {
  rawProductionDetailSchema,
  rawProductionSchema,
  type RawCredit,
  type RawCriticReview,
  type RawPerformance,
  type RawProduction,
  type RawProductionDetail,
  type SourceAdapter,
} from "../types";

/**
 * Helsingin Kaupunginteatteri, including Lilla Teatern (a stage of HKT here).
 * The list and production pages are server-rendered WordPress. Performances are not in
 * the page HTML: the theme loads them from HKT's own JSON endpoint
 * /wp-json/hkt/ticket-list/<post id>/, which we read the same way (one request per
 * production). Ticket links point to lippu.fi; we store them, never fetch them.
 */
const BASE = "https://hkt.fi";
export const LIST_URL = `${BASE}/esitykset/`;
const MAX_LIST_PAGES = 10;

type Page = cheerio.CheerioAPI;

/** "https://hkt.fi/esitykset/de-obehoriga/" → "de-obehoriga" */
function slugFromUrl(url: string): string {
  return url.replace(/^.*\/esitykset\//, "").replace(/[/?#].*$/, "");
}

/** "Lilla Teatern – Georgsgatan 30" → "Lilla Teatern" */
function stageName(text: string): string {
  return cleanText(text.split(/\s[–-]\s/)[0]);
}

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $("article.show--list-item").each((_, element) => {
    const item = $(element);
    const link = item.find("h2 a").first();
    const url = link.attr("href");
    const title = cleanText(link.text());
    if (!url || !title || !url.startsWith(`${BASE}/esitykset/`)) return;
    const externalId = slugFromUrl(url);
    if (!externalId || externalId === "feed" || externalId.startsWith("page")) return;
    const stage = cleanText(item.find(".emphasis").first().text());
    results.set(
      externalId,
      rawProductionSchema.parse({
        externalId,
        title,
        url,
        stageHint: stage ? stageName(stage) : undefined,
        authorHint: cleanText(item.find(".show--list--item-content > strong").first().text()) || undefined,
        isVisiting: false,
      }),
    );
  });
  return [...results.values()];
}

/** The next listing page from <link rel="next">, or null on the last page. */
export function parseNextPage(html: string): string | null {
  return cheerio.load(html)('link[rel="next"]').attr("href") ?? null;
}

/** HKT's WordPress post id, which keys the performance endpoint. */
export function parsePostId(html: string): string | null {
  const $ = cheerio.load(html);
  const fromList = $("#single-show-ticket-list").attr("data-id");
  if (fromList) return fromList;
  return html.match(/var tickets = \{[^}]*"post_id":"(\d+)"/)?.[1] ?? null;
}

const ticketListSchema = z.object({
  tickets: z
    .array(
      z.object({
        date: z.string().regex(/^\d{1,2}\.\d{1,2}\.\d{4}$/),
        time: z.string().regex(/^\d{1,2}:\d{2}$/),
        venue: z.object({ name: z.string() }).nullish(),
        url: z.string().nullish(),
      }),
    )
    .nullish(),
});

/** "20.10.2026" → "2026-10-20" */
function isoDate(finnish: string): string {
  const [day, month, year] = finnish.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Performances from /wp-json/hkt/ticket-list/<id>/. The response also has a Unix
 * `timestamp`, but it encodes Helsinki wall-clock time as if it were UTC (18:30 local
 * comes out as 18:30Z), so we build the instant from `date` and `time` instead.
 */
export function parseTicketList(json: string): RawPerformance[] {
  const parsed = ticketListSchema.safeParse(JSON.parse(json));
  if (!parsed.success) return [];
  const seen = new Set<number>();
  const performances: RawPerformance[] = [];
  for (const ticket of parsed.data.tickets ?? []) {
    const startsAt = helsinkiToUtc(isoDate(ticket.date), ticket.time.padStart(5, "0"));
    if (seen.has(startsAt.getTime())) continue;
    seen.add(startsAt.getTime());
    const ticketUrl = ticket.url?.replace(/&amp;/g, "&");
    performances.push({
      startsAt,
      stage: ticket.venue?.name ? cleanText(ticket.venue.name) : undefined,
      ticketUrl: ticketUrl && z.url().safeParse(ticketUrl).success ? ticketUrl : undefined,
    });
  }
  return performances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

interface MetaFacts {
  stage?: string;
  premiereDate?: Date;
  durationText?: string;
  languageNote: string;
}

/** The icon list under the title: stage, premiere, duration, language note. */
function parseMeta($: Page): MetaFacts {
  const facts: MetaFacts = { languageNote: "" };
  $("ul.show--meta li").each((_, element) => {
    const item = $(element);
    const icon = item.find("i").attr("class") ?? "";
    const text = cleanText(item.text());
    if (icon.includes("fa-map-marker")) facts.stage = stageName(cleanText(item.find("strong span").first().text()) || text);
    else if (icon.includes("fa-calendar")) {
      const date = text.match(/(?:ensi-ilta|premiär)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1];
      facts.premiereDate = date ? parseFinnishDate(date) : undefined;
    } else if (icon.includes("fa-clock")) facts.durationText = text || undefined;
    else if (icon.includes("fa-comment")) facts.languageNote = text;
  });
  return facts;
}

/** Facts stated in prose ("Esityskieli ruotsi", "textas på svenska och finska"); the prose itself is not kept. */
function languageFacts(texts: string[], stage: string | undefined): { languages: string[]; subtitleLangs: string[] } {
  const all = texts.join(" ");
  const spoken = all.match(/(?:esityskieli|föreställningsspråk)[:\s]+([^.,;]+)/i)?.[1];
  const subtitled = all.match(/(?:tekstitetään|tekstitys|textas|textning)([^.]*)/i)?.[1];
  const fallback = stage === "Lilla Teatern" ? ["sv"] : ["fi"];
  return {
    languages: spoken && languageCodes(spoken).length > 0 ? languageCodes(spoken) : fallback,
    subtitleLangs: subtitled ? languageCodes(subtitled) : [],
  };
}

function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $("#tekijat .show--other li").each((_, element) => {
    const name = cleanText($(element).find("h4").first().text());
    const roleText = cleanText($(element).find("p").first().text());
    const roles = mapRoleText(roleText);
    if (name && roles.length > 0) credits.push({ name, roleText, roles });
  });
  $("#tekijat .show--featured.actors li").each((_, element) => {
    const name = stripGuestMarker($(element).find("h4").first().text());
    const characterName = cleanText($(element).find("p").first().text()) || undefined;
    if (name) credits.push({ name, roleText: "Esiintyjät", roles: ["CAST"], characterName });
  });
  return credits;
}

/** "Helsingin Sanomat, 7.9.2026" → outlet and date; we keep the link, never the quoted text. */
function parseReviews($: Page): RawCriticReview[] {
  const reviews: RawCriticReview[] = [];
  $("#arviot .reviews--single").each((_, element) => {
    const item = $(element);
    const legend = cleanText(item.find(".reviews--single-legend").first().text());
    const url = item.find("a.link-button").attr("href");
    const match = legend.match(/^(.*),\s*(\d{1,2}\.\d{1,2}\.\d{4})$/);
    const outlet = cleanText(match?.[1] ?? legend);
    if (!outlet || !url) return;
    reviews.push({
      outlet,
      critic: cleanText(item.find("h4").first().text()) || undefined,
      url,
      publishedAt: match ? parseFinnishDate(match[2]) : undefined,
    });
  });
  return reviews;
}

export function parseDetail(
  html: string,
  ticketJson: string | null,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
): RawProductionDetail {
  const $ = cheerio.load(html);
  const description = $("article.show--description").first();
  const meta = parseMeta($);
  const performances = ticketJson ? parseTicketList(ticketJson) : [];
  const prose = description
    .find(".show--content p")
    .map((_, element) => cleanText($(element).text()))
    .get();
  const { languages, subtitleLangs } = languageFacts([meta.languageNote, ...prose], meta.stage);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: cleanText(description.find("h1").first().text()) || ref.title,
    url: ref.url,
    stage: meta.stage,
    // Only used to classify the type ("hittimusikaali"), never stored.
    subtitle: cleanText(description.children("strong").not(".over").first().text()) || undefined,
    durationText: meta.durationText,
    premiereDate: meta.premiereDate,
    runStart: meta.premiereDate ?? performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    languages,
    subtitleLangs,
    credits: parseCredits($),
    performances,
    criticReviews: parseReviews($),
    isVisiting: false,
  });
}

export const hktAdapter: SourceAdapter = {
  id: "hkt",
  async fetchProductions() {
    return collectPages(LIST_URL, (url) => politeFetch(url), parseList, parseNextPage, MAX_LIST_PAGES);
  },
  async fetchProductionDetail(ref) {
    const html = await politeFetch(ref.url);
    const postId = parsePostId(html);
    const ticketJson = postId ? await politeFetch(`${BASE}/wp-json/hkt/ticket-list/${postId}/`) : null;
    return parseDetail(html, ticketJson, ref);
  },
};
