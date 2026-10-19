import * as cheerio from "cheerio";
import { z } from "zod";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, parseFinnishDate, personName } from "../text";
import {
  rawProductionDetailSchema,
  rawProductionSchema,
  type CreditRoleName,
  type ProductionTypeName,
  type RawCredit,
  type RawPerformance,
  type RawProduction,
  type RawProductionDetail,
  type SourceAdapter,
} from "../types";

/**
 * Kansallisooppera ja -baletti (oopperabaletti.fi), WordPress. robots.txt disallows
 * /wp-json/, so we read server HTML only. The repertoire page embeds the whole season as
 * JSON in `data-posts` (with category ids named in `data-categories`); each production
 * page lists every upcoming performance as schema.org Event JSON-LD, with the Opera's own
 * shop link per performance. Facts (stage, run, language, credits) are in the hero's
 * <dl class="production-meta">, the team in <dl class="production-cast"> and the cast in
 * <dl class="production-roles">. No page states a premiere date (checked 18 Oct 2026):
 * "Milloin" is the run, which for a revival is not a premiere, so premiereDate stays unset.
 */
const BASE = "https://oopperabaletti.fi";
export const LIST_URL = `${BASE}/ohjelmisto/`;

type Page = cheerio.CheerioAPI;

const listPostSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string(),
  link: z.string(),
  author: z.string().nullish(),
  location: z.string().nullish(),
  meta: z.string().nullish(),
  categories: z.array(z.number()).default([]),
});
type ListPost = z.infer<typeof listPostSchema>;

const categorySchema = z.object({ id: z.number(), slug: z.string() });

/**
 * Category slugs that are never productions: guided tours, tea dances, free foyer
 * concerts, work introductions, "Ooppera kutsuu" open days (all "tapahtumat" or
 * "maksuttomat") and Stage24 live streams ("suorat").
 */
const SKIP_CATEGORIES = new Set(["tapahtumat", "maksuttomat", "suorat"]);
/** Kids' workshops filed under "Lapsille" like the real children's shows. */
const SKIP_TITLES = /taikatuokio|kiertokäyn|teetanss|teosesittely|ooppera kutsuu/i;

function decodeTitle(title: string): string {
  return cleanText(cheerio.load(`<p>${title}</p>`)("p").text());
}

function isProduction(post: ListPost, slugs: string[]): boolean {
  if (post.type !== "production" || !post.link.startsWith(`${BASE}/ohjelmisto/`)) return false;
  if (slugs.some((slug) => SKIP_CATEGORIES.has(slug))) return false;
  if (SKIP_TITLES.test(post.title)) return false;
  // Concert series and one-off concerts at other venues (Musiikkitalo, a church) are not
  // productions of the house; galas on its own stages are.
  if (slugs.includes("konsertit") && slugs.includes("esitykset-muualla")) return false;
  return true;
}

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const block = $(".js-block-repertoire").first();
  const categories = z.array(categorySchema).parse(JSON.parse(block.attr("data-categories") ?? "[]"));
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));
  const posts = z.array(listPostSchema).parse(JSON.parse(block.attr("data-posts") ?? "[]"));
  const results = new Map<string, RawProduction>();
  for (const post of posts) {
    const slugs = post.categories.map((id) => slugById.get(id) ?? "");
    if (!isProduction(post, slugs)) continue;
    const externalId = String(post.id);
    results.set(
      externalId,
      rawProductionSchema.parse({
        externalId,
        title: decodeTitle(post.title),
        url: post.link,
        stageHint: cleanText(post.location) || undefined,
        authorHint: cleanText(post.author) || undefined,
        isVisiting: slugs.includes("vierailevat-esitykset"),
      }),
    );
  }
  return [...results.values()];
}

/** The hero's "Kesto", "Milloin", "Missä", "Genre", "Kieli" … as a map. */
function productionMeta($: Page): Map<string, string> {
  const meta = new Map<string, string>();
  $(".production-meta dt").each((_, element) => {
    const key = cleanText($(element).text()).toLowerCase();
    const value = cleanText($(element).next("dd").text());
    if (key && value && !meta.has(key)) meta.set(key, value);
  });
  return meta;
}

/** "Genre" as printed; "Lapsille" names the audience, so the title decides there. */
export function typeFromGenre(genre: string | undefined, title: string): ProductionTypeName | undefined {
  const text = (genre ?? "").toLowerCase();
  if (/ooppera/.test(text)) return "OPERA";
  if (/baletti|tanssi/.test(text)) return "DANCE";
  if (/konsertti/.test(text)) return "CONCERT";
  if (/lapsille/.test(text)) {
    if (/ooppera/i.test(title)) return "OPERA";
    if (/baletti/i.test(title)) return "DANCE";
  }
  return undefined;
}

/** Sung languages that `languageCodes` does not know; opera is sung in the original. */
const EXTRA_LANGUAGES: Array<[RegExp, string]> = [
  [/italia/, "it"],
  [/tšekki|tsekki/, "cs"],
  [/latina/, "la"],
  [/puola/, "pl"],
  [/unkari/, "hu"],
];

function languagesIn(text: string): string[] {
  const lower = text.toLowerCase();
  const extra = EXTRA_LANGUAGES.filter(([pattern]) => pattern.test(lower)).map(([, code]) => code);
  return [...new Set([...languageCodes(text), ...extra])];
}

/** "Italia. Tekstitys suomeksi, ruotsiksi ja englanniksi" → sung it, surtitles fi/sv/en. */
export function parseLanguage(text: string | undefined): { languages: string[]; subtitleLangs: string[] } {
  if (!text) return { languages: [], subtitleLangs: [] };
  const [sung, ...rest] = text.split(/tekstity/i);
  // "Suomi, ei tekstitystä": no surtitles.
  const subtitleLangs = /ei tekstity/i.test(text)
    ? []
    : languagesIn(rest.join(" ")).filter((code) => ["fi", "sv", "en"].includes(code));
  return { languages: languagesIn(sung.replace(/,?\s*ei\s*$/i, "")), subtitleLangs };
}

/** "Musiikinjohto" is the conductor, not the composer: there is no conductor role yet. */
function creditRoles(roleText: string): CreditRoleName[] {
  if (/musiikinjoh|kapellimest/i.test(roleText)) return ["OTHER"];
  return mapRoleText(roleText);
}

/** "Pjotr Tšaikovski, Camille Saint-Saëns" → two people. */
function namesIn(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+ja\s+/)
    .map((part) => personName(part))
    .filter((name): name is string => Boolean(name));
}

function teamCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  let roleText = "";
  // A triple bill has one list per piece.
  $(".production-cast")
    .children("dt, dd")
    .each((_, element) => {
      const text = cleanText($(element).text());
      if (element.tagName === "dt") {
        roleText = text;
        return;
      }
      const roles = creditRoles(roleText);
      if (!roleText || roles.length === 0) return;
      for (const name of namesIn(text)) credits.push({ name, roleText, roles });
    });
  return credits;
}

/** One <div class="production-role"> per singer or dancer and character; alternates repeat the character. */
function castCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $(".production-roles .production-role").each((_, element) => {
    const characterName = cleanText($(element).find("dt").text());
    const name = personName($(element).find("dd").text());
    if (!name) return;
    credits.push({ name, roleText: "Rooleissa", roles: ["CAST"], characterName: characterName || undefined });
  });
  return credits;
}

const eventSchema = z.object({
  "@type": z.string(),
  startDate: z.string(),
  eventStatus: z.string().optional(),
  location: z.object({ name: z.string().optional() }).optional(),
  offers: z.object({ url: z.string().optional() }).optional(),
});

function jsonLdNodes($: Page): unknown[] {
  return $('script[type="application/ld+json"]')
    .map((_, element) => {
      try {
        const data: unknown = JSON.parse($(element).text());
        const graph = (data as { "@graph"?: unknown })["@graph"];
        return Array.isArray(graph) ? graph : [data];
      } catch {
        return [];
      }
    })
    .get();
}

/** "2026-10-22T19:00:00" is Helsinki wall-clock; an explicit offset is honoured. */
function eventInstant(startDate: string): Date | null {
  const match = startDate.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(.*)$/);
  if (!match) return null;
  return match[3] ? new Date(startDate) : helsinkiToUtc(match[1], match[2]);
}

export function parsePerformances($: Page): RawPerformance[] {
  const byTime = new Map<number, RawPerformance>();
  for (const node of jsonLdNodes($)) {
    const event = eventSchema.safeParse(node);
    if (!event.success || event.data["@type"] !== "Event") continue;
    if (/cancelled/i.test(event.data.eventStatus ?? "")) continue;
    const startsAt = eventInstant(event.data.startDate);
    if (!startsAt || Number.isNaN(startsAt.getTime())) continue;
    const ticketUrl = event.data.offers?.url;
    byTime.set(startsAt.getTime(), {
      startsAt,
      stage: cleanText(event.data.location?.name) || undefined,
      ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    });
  }
  return [...byTime.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** "22.10.2026 – 27.11.2026" or a single "30.11.2026". */
function runDates(text: string | undefined): { runStart?: Date; runEnd?: Date } {
  const [start, end] = (text ?? "").split(/\s*[–-]\s*/);
  const runStart = start ? parseFinnishDate(start) : undefined;
  return { runStart, runEnd: end ? parseFinnishDate(end) : runStart };
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title" | "isVisiting">,
): RawProductionDetail {
  const $ = cheerio.load(html);
  const meta = productionMeta($);
  const title = cleanText($("h1.wp-block-post-title").first().text()) || ref.title;
  const ticketUrl = $(".production-details .wp-block-button__link").first().attr("href");
  const run = runDates(meta.get("milloin"));
  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title,
    url: ref.url,
    stage: meta.get("missä"),
    typeHint: typeFromGenre(meta.get("genre"), title),
    durationText: meta.get("kesto"),
    ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    ...run,
    ...parseLanguage(meta.get("kieli")),
    credits: [...teamCredits($), ...castCredits($)],
    performances: parsePerformances($),
    // The page quotes reviews without links; we never store review text.
    criticReviews: [],
    isVisiting: ref.isVisiting,
    // Every upcoming performance is listed (past ones drop off).
    performancesPartial: false,
  });
}

export const kansallisoopperaAdapter: SourceAdapter = {
  id: "kansallisooppera",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
