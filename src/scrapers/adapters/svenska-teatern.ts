import * as cheerio from "cheerio";
import { z } from "zod";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, nameCaseShouting, parseFinnishDate } from "../text";
import {
  rawProductionDetailSchema,
  type RawCredit,
  type RawPerformance,
  type RawProduction,
  type RawProductionDetail,
  type SourceAdapter,
} from "../types";

const BASE = "https://svenskateatern.fi";
const PER_PAGE = 100;

export function showsUrl(page: number): string {
  return `${BASE}/wp-json/wp/v2/shows?per_page=${PER_PAGE}&page=${page}&_fields=id,title,link,modified`;
}

const restShowSchema = z.object({
  id: z.number(),
  link: z.url(),
  modified: z.string(),
  title: z.object({ rendered: z.string() }),
});

/** Decode the HTML entities WordPress leaves in rendered titles. */
function decodeTitle(rendered: string): string {
  return cleanText(cheerio.load(`<p>${rendered}</p>`)("p").text());
}

/** Parse one page of the WordPress REST "shows" endpoint. */
export function parseShowsJson(json: string): RawProduction[] {
  const items = z.array(z.unknown()).parse(JSON.parse(json));
  const results: RawProduction[] = [];
  for (const item of items) {
    const parsed = restShowSchema.safeParse(item);
    if (!parsed.success) continue;
    results.push({
      externalId: String(parsed.data.id),
      title: decodeTitle(parsed.data.title.rendered),
      url: parsed.data.link,
      isVisiting: false,
      // WordPress gives local Helsinki time without an offset.
      sourceUpdatedAt: helsinkiToUtc(parsed.data.modified.slice(0, 10), parsed.data.modified.slice(11, 16)),
    });
  }
  return results;
}

const performanceJsonSchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{3,4}$/),
    venue: z.string().optional(),
    tickets_link: z.string().optional(),
    blocked: z.boolean().optional(),
  }),
);

function parsePerformances($: cheerio.CheerioAPI): RawPerformance[] {
  const raw = $("[data-performances]").first().attr("data-performances");
  if (!raw) return [];
  const parsed = performanceJsonSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return [];
  const performances = parsed.data.map((row) => {
    const time = row.time.padStart(4, "0");
    return {
      startsAt: helsinkiToUtc(row.date, `${time.slice(0, 2)}:${time.slice(2)}`),
      stage: row.venue ? cleanText(row.venue) : undefined,
      ticketUrl: row.tickets_link && /^https?:\/\//.test(row.tickets_link) ? row.tickets_link : undefined,
    };
  });
  return performances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Read the "info-box" key/value pairs: Premiär, Spelperiod, Scen, Längd, Textning … */
function parseInfoBox($: cheerio.CheerioAPI): Map<string, string> {
  const info = new Map<string, string>();
  $(".info-box .sub-section").each((_, element) => {
    const section = $(element);
    const key = cleanText(section.find("p.title").first().text()).toLowerCase();
    const value = cleanText(section.find("p").not(".title").first().text());
    if (key && value && !info.has(key)) info.set(key, value);
  });
  return info;
}

/**
 * Guest musicals without a team list print it as centred paragraphs instead (Änglagård,
 * Oct 2026): "<strong>Regi<br></strong>MARIA LUNDSTRÖM", names in capitals.
 */
function centredCredits($: cheerio.CheerioAPI): RawCredit[] {
  const credits: RawCredit[] = [];
  $("p.has-text-align-center").each((_, element) => {
    const paragraph = $(element);
    const label = paragraph.children("strong").first();
    const roleText = cleanText(label.text());
    if (!roleText || paragraph.contents().first().get(0) !== label.get(0)) return;
    const name = cleanText(paragraph.text().slice(label.text().length));
    const roles = mapRoleText(roleText);
    if (name && roles.length > 0) credits.push({ name: nameCaseShouting(name), roleText, roles });
  });
  return credits;
}

function parseCredits($: cheerio.CheerioAPI): RawCredit[] {
  const credits: RawCredit[] = [];
  $(".member").each((_, element) => {
    const member = $(element);
    const name = cleanText(member.find(".member-name").text());
    const roleText = cleanText(member.find(".member-title").text());
    const roles = mapRoleText(roleText);
    if (name && roles.length > 0) credits.push({ name, roleText, roles });
  });
  if (credits.length === 0) credits.push(...centredCredits($));
  $(".single-person").each((_, element) => {
    const person = $(element);
    const name = cleanText(person.find("h3.name").first().text());
    const characterName = cleanText(person.find(".alias").first().text()) || undefined;
    if (name) credits.push({ name, roleText: "Ensemble", roles: ["CAST"], characterName });
  });
  return dedupeCredits(credits);
}

function dedupeCredits(credits: RawCredit[]): RawCredit[] {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const key = `${credit.name}|${credit.roles.join(",")}|${credit.characterName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title"> & { sourceUpdatedAt?: Date },
): RawProductionDetail {
  const $ = cheerio.load(html);
  const info = parseInfoBox($);
  const performances = parsePerformances($);
  const period = info.get("spelperiod") ?? "";
  const [periodStart, periodEnd] = period.split(/[–—-]/).map((part) => parseFinnishDate(part));
  const title = cleanText($(".block-show-information h1").first().text()) || ref.title;

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title,
    url: ref.url,
    stage: info.get("scen") ?? performances.find((performance) => performance.stage)?.stage,
    subtitle: cleanText($(".block-show-information h3").first().text()) || undefined,
    durationText: info.get("längd"),
    premiereDate: info.has("premiär") ? parseFinnishDate(info.get("premiär") ?? "") : undefined,
    sourceUpdatedAt: ref.sourceUpdatedAt,
    runStart: periodStart ?? performances[0]?.startsAt,
    runEnd: periodEnd ?? performances.at(-1)?.startsAt,
    languages: ["sv"],
    subtitleLangs: languageCodes(info.get("textning") ?? ""),
    credits: parseCredits($),
    performances,
    criticReviews: [],
    isVisiting: /^(riksteatern|teater mars|kompani)\b/i.test(title),
  });
}

export const svenskaTeaternAdapter: SourceAdapter = {
  id: "svenska-teatern",
  async fetchProductions() {
    const all: RawProduction[] = [];
    for (let page = 1; page <= 20; page += 1) {
      let body: string;
      try {
        body = await politeFetch(showsUrl(page));
      } catch (error) {
        // WordPress answers 400 when the page number is past the last page.
        if (page > 1 && error instanceof Error && /HTTP 400/.test(error.message)) break;
        throw error;
      }
      const items = parseShowsJson(body);
      all.push(...items);
      if (items.length < PER_PAGE) break;
    }
    return all;
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
