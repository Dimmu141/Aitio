import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { collectPages } from "../paginate";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, yearFromWeekday } from "../text";
import {
  rawProductionDetailSchema,
  rawProductionSchema,
  type RawCredit,
  type RawPerformance,
  type RawProduction,
  type RawProductionDetail,
  type SourceAdapter,
} from "../types";

/**
 * Espoon Teatteri. The repertoire is server-rendered with pagination. A production page
 * loads its performances through admin-ajax.php (action get_event_shows) and only ever
 * shows the next few of them; the full schedule is only in the theatre's Lippu.fi shop,
 * which we never fetch. So the performance list is marked partial (see normalise.ts).
 * Dates have no year: the printed weekday pins it down exactly.
 */
const BASE = "https://espoonteatteri.fi";
export const LIST_URL = `${BASE}/ohjelmisto/`;
const AJAX_URL = `${BASE}/wp-admin/admin-ajax.php`;
const MAX_LIST_PAGES = 10;

type Page = cheerio.CheerioAPI;

function slugFromUrl(url: string): string {
  return url.replace(/^.*\/ohjelmisto\//, "").replace(/[/?#].*$/, "");
}

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $("#events-archive .archive-item").each((_, element) => {
    const item = $(element);
    const url = item.attr("data-url");
    const title = cleanText(item.find("h2").first().text());
    if (!url || !title) return;
    const externalId = slugFromUrl(url);
    if (!externalId || externalId === "arkisto" || externalId.startsWith("page")) return;
    results.set(externalId, rawProductionSchema.parse({ externalId, title, url, isVisiting: false }));
  });
  return [...results.values()];
}

export function parseNextPage(html: string): string | null {
  return cheerio.load(html)('link[rel="next"]').attr("href") ?? null;
}

/** The id the page's own script posts to admin-ajax.php to load its performances. */
export function parseShowsId(html: string): string | null {
  return html.match(/var eventShowsId = (\d+)/)?.[1] ?? null;
}

/** Text of an element without screen-reader labels, icon fonts and links. */
function ownText($: Page, element: cheerio.Cheerio<never>): string {
  const clone = element.clone();
  clone.find(".sr-only, .screen-reader-text, .et-font, a").remove();
  return cleanText(clone.text());
}

/** The facts list: "Näyttämö", "Kieli", "Tekstitys". */
function parseFacts($: Page): Map<string, string> {
  const facts = new Map<string, string>();
  $("section.event-details li").each((_, element) => {
    const label = cleanText($(element).find("strong").first().text()).toLowerCase();
    const value = ownText($, $(element).find("p").first() as cheerio.Cheerio<never>);
    if (label) facts.set(label, value);
  });
  return facts;
}

/** "englanti, ei tekstitystä" → the spoken part only. */
function spokenLanguages(value: string | undefined): string[] {
  const spoken = (value ?? "").replace(/[^,.]*tekstity[^,.]*/gi, "");
  return languageCodes(spoken);
}

function subtitleLanguages(facts: Map<string, string>): string[] {
  const explicit = facts.get("tekstitys");
  const text = explicit ?? (facts.get("kieli") ?? "").match(/[^,.]*tekstity[^,.]*/i)?.[0] ?? "";
  if (/^\s*ei\b/i.test(text)) return [];
  return languageCodes(text.replace(/tekstity\w*/gi, ""));
}

const NOT_PEOPLE = /tukija|yhteistyö|kumppan|tuotanto|rahoitta/i;

/** Team table: role in <th>, comma-separated names in <td>. */
function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $("section.event-team tr").each((_, element) => {
    const roleText = cleanText($(element).find("th").text().replace(/­/g, ""));
    if (NOT_PEOPLE.test(roleText)) return;
    const roles = roleText ? mapRoleText(roleText) : ["OTHER" as const];
    if (roles.length === 0) return;
    for (const name of $(element).find("td").text().split(/,|\sja\s/)) {
      const clean = cleanText(name);
      if (clean) credits.push({ name: clean, roleText: roleText || "Työryhmä", roles });
    }
  });
  return credits;
}

/** "la 14.11." + "18.30"; the weekday decides the year. Ensi-ilta marks the premiere. */
export function parseShows(html: string, asOf: Date): { performances: RawPerformance[]; premiere?: Date } {
  const $ = cheerio.load(html);
  const performances: RawPerformance[] = [];
  let premiere: Date | undefined;
  $(".event-performances tr").each((_, element) => {
    const row = $(element);
    const date = cleanText(row.find(".date").first().text()).match(/^(\p{L}{2})\s+(\d{1,2})\.(\d{1,2})\./u);
    const time = cleanText(row.find(".time").first().text()).match(/(\d{1,2})[.:](\d{2})/);
    if (!date || !time) return;
    const [day, month] = [Number(date[2]), Number(date[3])];
    const year = yearFromWeekday(day, month, date[1], asOf);
    if (!year) return;
    const startsAt = helsinkiToUtc(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      `${time[1].padStart(2, "0")}:${time[2]}`,
    );
    if (/ensi-ilta/i.test(row.find(".details").text())) premiere ??= startsAt;
    performances.push({
      startsAt,
      ticketUrl: row.find(".ticket-cta a").first().attr("href") || undefined,
    });
  });
  return { performances: performances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()), premiere };
}

/** "14.11.-30.12." with the year from the first performance (or asOf); handles New Year. */
function parseRange(text: string, anchor: Date): { start?: Date; end?: Date } {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.\s*-\s*(\d{1,2})\.(\d{1,2})\./);
  if (!match) return {};
  const [, startDay, startMonth, endDay, endMonth] = match.map(Number);
  const anchorYear = anchor.getUTCFullYear();
  const startYear = startMonth > anchor.getUTCMonth() + 1 + 6 ? anchorYear - 1 : anchorYear;
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;
  return {
    start: new Date(Date.UTC(startYear, startMonth - 1, startDay)),
    end: new Date(Date.UTC(endYear, endMonth - 1, endDay)),
  };
}

function pageTitle($: Page): string {
  const heading = $("header.entry-header h1").first();
  return (
    cleanText(heading.find("ul.texts li").first().text()) ||
    cleanText(heading.find("[aria-label]").first().attr("aria-label")) ||
    cleanText(heading.text())
  );
}

export function parseDetail(
  html: string,
  showsHtml: string | null,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
  asOf: Date = new Date(),
): RawProductionDetail {
  const $ = cheerio.load(html);
  const facts = parseFacts($);
  const { performances, premiere } = parseShows(showsHtml ?? html, asOf);
  const stage = facts.get("näyttämö")?.split(",")[0];
  const range = parseRange(
    cleanText($("header.entry-header .event-date-range").first().text()),
    performances[0]?.startsAt ?? asOf,
  );
  const genre = cleanText($(".event-genre-list").first().text());

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: pageTitle($) || ref.title,
    url: ref.url,
    stage: stage ? cleanText(stage) : undefined,
    // The genre ("Nykysirkus", "Peliesitys") only helps the classifier; not stored.
    subtitle: genre || undefined,
    premiereDate: premiere,
    runStart: range.start ?? performances[0]?.startsAt,
    runEnd: range.end ?? performances.at(-1)?.startsAt,
    languages: spokenLanguages(facts.get("kieli")),
    subtitleLangs: subtitleLanguages(facts),
    credits: parseCredits($),
    performances: performances.map((performance) => ({ ...performance, stage: stage ? cleanText(stage) : undefined })),
    criticReviews: [],
    isVisiting: false,
    performancesPartial: true,
  });
}

export const espoonTeatteriAdapter: SourceAdapter = {
  id: "espoon-teatteri",
  async fetchProductions() {
    return collectPages(LIST_URL, (url) => politeFetch(url), parseList, parseNextPage, MAX_LIST_PAGES);
  },
  async fetchProductionDetail(ref) {
    const html = await politeFetch(ref.url);
    const hasShows = cheerio.load(html)(".event-performances tr").length > 0;
    const showsId = parseShowsId(html);
    const showsHtml =
      !hasShows && showsId ? await politeFetch(AJAX_URL, { action: "get_event_shows", event_id: showsId }) : null;
    return parseDetail(html, showsHtml, ref);
  },
};
