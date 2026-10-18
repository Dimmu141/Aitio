import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, personName, yearFromWeekday } from "../text";
import {
  rawProductionDetailSchema,
  rawProductionSchema,
  type CreditRoleName,
  type RawCredit,
  type RawPerformance,
  type RawProduction,
  type RawProductionDetail,
  type SourceAdapter,
} from "../types";

/**
 * Zodiak – Uuden tanssin keskus: a Drupal site with clean server HTML. The programme page
 * lists every current item with all its dates; each date is a paragraph carrying
 * `data-date="2026-10-06"` (the year is printed, so no guessing) and "klo 19" as text.
 * Only items whose type is "Esitys" (`type-esitykset`) are performances: panels
 * ("Keskustelut"), seminars, "Muu tapahtuma" and the free Zodiak Laboratory showings
 * ("Z-Lab", no tickets) are skipped. Some productions play at Tanssin talo.
 */
const BASE = "https://www.zodiak.fi";
export const LIST_URL = `${BASE}/fi/ohjelmisto`;
export const CALENDAR_URL = `${BASE}/fi/ohjelmistokalenteri`;
const DEFAULT_STAGE = "Zodiak Stage";
const PERFORMANCE_TYPE_CLASS = "type-esitykset";

/** Some links come as "/index%2Ephp/fi/ohjelmisto/…": the same page as "/fi/ohjelmisto/…". */
export function canonicalUrl(href: string): string {
  const path = decodeURIComponent(href.replace(/^https?:\/\/[^/]+/, "")).replace(/^\/index\.php/i, "");
  return `${BASE}${path.replace(/[?#].*$/, "")}`;
}

function slugFromUrl(url: string): string {
  return url.replace(/^.*\/ohjelmisto\//, "").replace(/[/?#].*$/, "");
}

/** "Eliel Tammiharju: " before the title, without its colon. */
function performerPrefix(text: string): string | undefined {
  return cleanText(text).replace(/:$/, "") || undefined;
}

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $(".zodiak-filterable-item").each((_, element) => {
    const item = $(element);
    if (!item.hasClass(PERFORMANCE_TYPE_CLASS)) return;
    const heading = item.find("h2").first();
    const href = heading.find("a").attr("href");
    const title = cleanText(heading.find(".node-label").first().text());
    if (!href || !title) return;
    const url = canonicalUrl(href);
    const externalId = slugFromUrl(url);
    if (!externalId) return;
    results.set(
      externalId,
      rawProductionSchema.parse({
        externalId,
        title,
        url,
        stageHint: cleanText(item.find(".calendar-details .venue").first().text()) || undefined,
        authorHint: performerPrefix(heading.find(".performer-title, .tekija").first().text()),
        isVisiting: false,
      }),
    );
  });
  return [...results.values()];
}

type Page = cheerio.CheerioAPI;

interface DateRow {
  startsAt: Date;
  /** "YYYY-MM-DD" in Helsinki. */
  date: string;
  premiere: boolean;
}

/** "la 10.10." with no year: the printed weekday decides, near `asOf`. */
function dateFromText(text: string, weekday: string, asOf: Date): string | null {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\./);
  if (!match) return null;
  const [day, month] = [Number(match[1]), Number(match[2])];
  const year = yearFromWeekday(day, month, weekday, asOf);
  if (!year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "klo 19", "klo 15:30", "klo 19.30" → "HH:MM". */
function timeFromText(text: string): string | null {
  const match = text.match(/(\d{1,2})(?:[.:](\d{2}))?/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2] ?? "00"}`;
}

export function parseDates($: Page, asOf: Date): DateRow[] {
  const rows: DateRow[] = [];
  $(".field--name-field-tapahtuma-ajat-ref .paragraph--type--esitysaika").each((_, element) => {
    const row = $(element);
    const printedDate = cleanText(row.find(".date").first().text());
    const date =
      row.attr("data-date")?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
      dateFromText(printedDate, cleanText(row.find(".day-of-week").first().text()), asOf);
    const time = timeFromText(cleanText(row.find(".time").first().text().replace(/klo/i, "")));
    if (!date || !time) return;
    rows.push({
      startsAt: helsinkiToUtc(date, time),
      date,
      premiere: /ensi-ilta/i.test(row.find(".field--name-field-tila").text()) || row.hasClass("esitysaika-tila--ensi-ilta"),
    });
  });
  return rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Roles that are crew, support or admin, not the artistic team. */
const SKIP_ROLE =
  /assist|apulais|teknikko|ompelu|kaavoitus|valokuv|tiiseri|traileri|mentori|konsult|tuotan|tuottaj|tukija|residenssi|levitys|hallinto|varainhank|yhteistyö|kumppan/i;
/** Group words that pass `personName` as a single lowercase word. */
const NOT_A_PERSON = /^(työryhmä|ryhmä|ensemble|kaikki)$/i;

/** mapRoleText plus dancers and performers ("Tanssijat", "Esiintyjät"), which it doesn't know. */
export function zodiakRoles(roleText: string): CreditRoleName[] {
  if (SKIP_ROLE.test(roleText)) return [];
  const roles = new Set(mapRoleText(roleText).filter((role) => role !== "OTHER"));
  if (/tanssij|esiintyj|performer|dancer/i.test(roleText)) roles.add("CAST");
  return [...roles];
}

/** "Simone Benini (IT), Julia Mäkelä (FI) Arolin Raudva (EE), feat. Elina Pirinen (FI)" → names. */
export function splitNames(value: string): string[] {
  return value
    .replace(/\s*\([A-Z]{2,3}\)\s*,?/g, ",")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bfeat\.\s*/gi, "")
    .split(/\s*,\s*|\s+ja\s+|\s+&\s+/)
    .map((name) => personName(name))
    .filter((name): name is string => name !== null && !NOT_A_PERSON.test(name));
}

/** The credits field: lines "<strong>Koreografia</strong>: Kati Raatikainen" split by <br>. */
function parseCredits($: Page): RawCredit[] {
  const credits = new Map<string, RawCredit>();
  $(".field--name-field-tekijatiedot p").each((_, element) => {
    for (const fragment of ($(element).html() ?? "").split(/<br\s*\/?>/i)) {
      const line = cleanText(cheerio.load(`<div>${fragment}</div>`)("div").text());
      const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
      if (!match) continue;
      const roleText = cleanText(match[1]);
      const roles = zodiakRoles(roleText);
      if (roles.length === 0) continue;
      for (const name of splitNames(match[2])) {
        credits.set(`${name}|${roleText}`, { name, roleText, roles });
      }
    }
  });
  return [...credits.values()];
}

/** "Kesto: n. 80 min (ei väliaikaa)" and "Esityskieli: englanti" from the sidebar. */
function sidebarValue($: Page, label: string): string | undefined {
  const text = $(".field--name-field-sivupalkki")
    .find("p")
    .map((_, element) => ($(element).html() ?? "").split(/<br\s*\/?>/i))
    .get()
    .map((fragment: string) => cleanText(cheerio.load(`<div>${fragment}</div>`)("div").text()));
  const pattern = new RegExp(`^${label}\\s*:\\s*(.+)$`, "i");
  for (const line of text) {
    const match = line.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return undefined;
}

function utcMidnight(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title"> & Partial<Pick<RawProduction, "stageHint">>,
  asOf: Date = new Date(),
): RawProductionDetail {
  const $ = cheerio.load(html);
  const title = cleanText($("h1 .node-label").first().text()) || ref.title;
  const stage =
    cleanText($(".field--name-field-tapahtumapaikka-ref .field__item").first().text()) || ref.stageHint || DEFAULT_STAGE;
  const dates = parseDates($, asOf);
  const performances: RawPerformance[] = dates.map((row) => ({ startsAt: row.startsAt, stage }));
  const ticketUrl = $(".field--name-field-lippulinkki a[href]").first().attr("href");
  const premiere = dates.find((row) => row.premiere);
  const language = sidebarValue($, "Esityskieli");

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title,
    url: ref.url,
    stage,
    typeHint: "DANCE",
    durationText: sidebarValue($, "Kesto"),
    ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    premiereDate: premiere ? utcMidnight(premiere.date) : undefined,
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    // Dance pages state a language only when there is text; unstated stays empty.
    languages: language ? languageCodes(language) : [],
    subtitleLangs: [],
    credits: parseCredits($),
    performances,
    criticReviews: [],
    isVisiting: false,
    performancesPartial: false,
  });
}

export const zodiakAdapter: SourceAdapter = {
  id: "zodiak",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref, new Date());
  },
};
