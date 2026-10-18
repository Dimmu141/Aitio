import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, parseFinnishDate, personName, stripGuestMarker, yearFromWeekday } from "../text";
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
 * Q-teatteri: a Webflow site with no API or JSON-LD. "/esitykset" lists the current
 * productions; each production page has its season ("21.9.2026 – 11.12.2026"), one
 * Tiketti link and hand-written dates in one of two shapes:
 *   "LOKAKUU 1 | 2 | 3* | 6" with "Esitykset klo 18:30, poikkeuksena *-merkityt … klo 14:00"
 *   "Ke 2.12. klo 18:00" (one performance per line, weekday printed).
 * Years come from the printed year, the weekday or the season, never a guess.
 */
const BASE = "https://www.q-teatteri.fi";
export const LIST_URL = `${BASE}/esitykset`;
const DEFAULT_STAGE = "Q-teatteri";

const MONTHS: Record<string, number> = {
  tammikuu: 1, helmikuu: 2, maaliskuu: 3, huhtikuu: 4, toukokuu: 5, kesäkuu: 6,
  heinäkuu: 7, elokuu: 8, syyskuu: 9, lokakuu: 10, marraskuu: 11, joulukuu: 12,
};

type Page = cheerio.CheerioAPI;

function slugFromUrl(url: string): string {
  return url.replace(/^.*\/esitykset\//, "").replace(/[/?#].*$/, "");
}

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $(".esitykset-sivu-item").each((_, element) => {
    const item = $(element);
    const href = item.find('a[href^="/esitykset/"]').first().attr("href");
    const title = cleanText(item.find("h2").first().text());
    if (!href || !title) return;
    const externalId = slugFromUrl(href);
    if (!externalId) return;
    results.set(externalId, rawProductionSchema.parse({ externalId, title, url: `${BASE}/esitykset/${externalId}`, isVisiting: false }));
  });
  return [...results.values()];
}

/** Rich text as lines: one per paragraph, heading or <br>. */
function richLines($: Page, selector: string): string[] {
  const html = $(selector)
    .map((_, element) => $(element).html() ?? "")
    .get()
    .join("\n");
  const text = cheerio
    .load(`<div>${html.replace(/<br\s*\/?>|<\/(?:p|h\d|li)>/gi, "\n")}</div>`)("div")
    .text();
  return text.split("\n").map(cleanText).filter(Boolean);
}

export interface Season {
  start: Date;
  end: Date;
}

/** The "esityskausi" box: two dates, the second always with a four-digit year. */
export function parseSeason($: Page): Season | undefined {
  const parts = $(".esityskausi div")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter((part) => /\d/.test(part));
  const start = parts[0] ? parseFinnishDate(parts[0]) : undefined;
  const end = parts[1] ? parseFinnishDate(parts[1]) : undefined;
  return start && end ? { start, end } : undefined;
}

/** The one year in the season that contains day.month, or null. */
function yearInSeason(day: number, month: number, season: Season | undefined): number | null {
  if (!season) return null;
  for (let year = season.start.getUTCFullYear(); year <= season.end.getUTCFullYear(); year += 1) {
    const date = Date.UTC(year, month - 1, day);
    if (date >= season.start.getTime() && date <= season.end.getTime()) return year;
  }
  return null;
}

/** "peruttu", "perutaan", "perumaan", "PERUUTUS". */
const CANCELLED = /peru(?:ttu|taan|maan|utus|utettu|ttiin)/i;

const pad = (value: number | string) => String(value).padStart(2, "0");
const dayKey = (day: number, month: number) => `${day}.${month}`;
const TIME = /(\d{1,2})[.:](\d{2})/;

function toTime(match: RegExpMatchArray | null): string | null {
  return match ? `${pad(match[1])}:${match[2]}` : null;
}

/** "PERUUTUS! LA 26.9. esitys on jouduttu perumaan": dates that will not be played. */
function cancelledDays(lines: string[]): Set<string> {
  const days = new Set<string>();
  for (const line of lines.filter((candidate) => CANCELLED.test(candidate))) {
    for (const match of line.matchAll(/(\d{1,2})\.(\d{1,2})\./g)) days.add(dayKey(Number(match[1]), Number(match[2])));
  }
  return days;
}

export interface PageDates {
  performances: Date[];
  premiere?: Date;
}

/** "Esitykset klo 18:30, poikkeuksena *-merkityt lauantait klo 14:00" → both times. */
function defaultTimes(lines: string[]): { plain: string | null; starred: string | null } {
  const line = lines.find((candidate) => /^esitykset\s+klo/i.test(candidate)) ?? "";
  const [plainPart, starPart] = line.split(/\*/);
  return { plain: toTime(plainPart.match(TIME)), starred: starPart ? toTime(starPart.match(TIME)) : null };
}

/** "LOKAKUU 1 | 2 | 3* | 23 ensi-ilta (LM)": a month heading followed by days. */
function monthRowDates(lines: string[], season: Season | undefined, result: PageDates): void {
  const times = defaultTimes(lines);
  for (const line of lines) {
    const row = line.match(/^([a-zäö]+kuu)\s+(\d.*)$/i);
    const month = row ? MONTHS[row[1].toLowerCase()] : undefined;
    if (!row || !month) continue;
    for (const entry of row[2].split("|").map(cleanText)) {
      const day = Number(entry.match(/^\d{1,2}/)?.[0]);
      const time = toTime(entry.match(/klo\s*(\d{1,2})[.:](\d{2})/i)) ?? (entry.includes("*") ? times.starred : times.plain);
      const year = day ? yearInSeason(day, month, season) : null;
      if (!year || !time) continue;
      const startsAt = helsinkiToUtc(`${year}-${pad(month)}-${pad(day)}`, time);
      result.performances.push(startsAt);
      if (/ensi-ilta/i.test(entry) && !result.premiere) result.premiere = startsAt;
    }
  }
}

/** "Ke 2.12. klo 18:00", "La 28.11.2026 Ensi-ilta klo 18.00", "La 5.12. klo 13.00 ja 18.00". */
function dateLineDates(lines: string[], season: Season | undefined, near: Date, result: PageDates): void {
  for (const line of lines) {
    const match = line.match(/^(?:(ma|ti|ke|to|pe|la|su)\p{L}*\.?\s+)?(\d{1,2})\.(\d{1,2})\.(\d{4})?(.*)$/iu);
    if (!match || !/klo/i.test(match[5])) continue;
    const [, weekday, dayText, monthText, yearText, rest] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = yearText
      ? Number(yearText)
      : weekday
        ? yearFromWeekday(day, month, weekday, season?.start ?? near)
        : yearInSeason(day, month, season);
    if (!year) continue;
    const timesText = rest.slice(rest.search(/klo/i));
    for (const time of timesText.matchAll(/(\d{1,2})[.:](\d{2})/g)) {
      const startsAt = helsinkiToUtc(`${year}-${pad(month)}-${pad(day)}`, `${pad(time[1])}:${time[2]}`);
      result.performances.push(startsAt);
      if (/ensi-ilta/i.test(rest) && !result.premiere) result.premiere = startsAt;
    }
  }
}

function helsinkiDayKey(instant: Date): string {
  const parts = new Intl.DateTimeFormat("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric" }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return dayKey(get("day"), get("month"));
}

/** Both date shapes, minus cancelled days, sorted and without duplicates. */
export function parsePageDates(lines: string[], season: Season | undefined, near: Date): PageDates {
  const result: PageDates = { performances: [] };
  const cancelled = cancelledDays(lines);
  const live = lines.filter((line) => !CANCELLED.test(line));
  monthRowDates(live, season, result);
  dateLineDates(live, season, near, result);
  const unique = new Map(result.performances.map((startsAt) => [startsAt.getTime(), startsAt]));
  result.performances = [...unique.values()]
    .filter((startsAt) => !cancelled.has(helsinkiDayKey(startsAt)))
    .sort((a, b) => a.getTime() - b.getTime());
  result.premiere ??= premiereLine(live, result.performances);
  return result;
}

/** "Ensi-ilta 27.2.2026" on a line of its own: the performance that day, else the date. */
function premiereLine(lines: string[], performances: Date[]): Date | undefined {
  const match = lines.map((line) => line.match(/ensi-ilta\D*(\d{1,2})\.(\d{1,2})\.(\d{4})/i)).find(Boolean);
  if (!match) return undefined;
  const key = dayKey(Number(match[1]), Number(match[2]));
  return performances.find((startsAt) => helsinkiDayKey(startsAt) === key) ?? parseFinnishDate(match[0]);
}

/** Photographers are credited for press photos, not for the production. */
const SKIPPED_ROLE = /valokuv|^kuvat$|^kuvaaja/i;

function rolesFor(roleText: string): CreditRoleName[] {
  // "Esiintyjät" is not in the shared role table yet.
  if (/esiinty/i.test(roleText)) return ["CAST"];
  if (/kuvaaj/i.test(roleText)) return ["OTHER"];
  return mapRoleText(roleText);
}

function namesIn(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+(?:ja|&)\s+/)
    .map((part) => stripGuestMarker(part))
    .map((part) => personName(part))
    .filter((name): name is string => !!name && !/^työryhmä$/i.test(name));
}

/** "Role Name ja Name" without a colon: the role is the words before the first capital one. */
function splitWithoutColon(line: string): [string, string] | null {
  const words = line.split(" ");
  const first = words.findIndex((word, index) => index > 0 && /^\p{Lu}/u.test(word));
  if (first < 1) return null;
  const roleText = words.slice(0, first).join(" ");
  if (rolesFor(roleText).every((role) => role === "OTHER")) return null;
  return [roleText, words.slice(first).join(" ")];
}

/** A role with no names yet, or a name list ending in a comma, continues on the next line. */
function nextPending(
  current: { roleText: string; mode: "header" | "comma" } | null,
  roleText: string,
  namesText: string,
  hasColon: boolean,
): { roleText: string; mode: "header" | "comma" } | null {
  if (!namesText) return { roleText, mode: "header" };
  if (current?.mode === "header" && !hasColon) return current;
  return namesText.endsWith(",") ? { roleText, mode: "comma" } : null;
}

/**
 * Credits in three hand-written styles: "Ohjaus: Name", "<strong>Esiintyjät:</strong>"
 * followed by one name per line, and "Sovitus ja ohjaus Juho Mantere" with no colon.
 * Notes in brackets ("(Taiteellinen opinnäyte, TeM)", "(Q-teatteri)") are dropped.
 */
export function parseCredits(lines: string[]): RawCredit[] {
  const credits: RawCredit[] = [];
  // "header": a role with no names, continuing until the next role; "comma": one more line.
  let pending: { roleText: string; mode: "header" | "comma" } | null = null;
  for (const raw of lines) {
    const line = cleanText(raw.replace(/\([^)]*\)/g, " ").replace(/>>|[\u200b-\u200d\ufeff]/g, ""));
    if (!line) continue;
    const colon = line.indexOf(":");
    let split: [string, string] | null = null;
    if (colon > 0 && colon < 50) split = [cleanText(line.slice(0, colon)), cleanText(line.slice(colon + 1))];
    else if (pending) split = [pending.roleText, line];
    else split = splitWithoutColon(line);
    if (!split) {
      pending = null;
      continue;
    }
    const [roleText, namesText] = split;
    if (SKIPPED_ROLE.test(roleText)) {
      pending = null;
      continue;
    }
    for (const name of namesIn(namesText)) credits.push({ name, roleText, roles: rolesFor(roleText) });
    pending = nextPending(pending, roleText, namesText, colon > 0);
  }
  return credits;
}

function ticketLink($: Page): string | undefined {
  const wrapper = $(".esitykset-tiketti-wrapper").first();
  if (wrapper.hasClass("w-condition-invisible")) return undefined;
  const href = wrapper.find("a[href]").not(".w-condition-invisible").first().attr("href");
  return href && /^https?:\/\//.test(href) ? href : undefined;
}

/** "Esitykset Puoli-Q -näyttämöllä" names the stage; otherwise the main house. */
function stageName(lines: string[]): string {
  const named = lines.map((line) => line.match(/(\S+)\s+-?näyttämöllä/i)?.[1]).find(Boolean);
  return named ?? DEFAULT_STAGE;
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
  asOf: Date = new Date(),
): RawProductionDetail {
  const $ = cheerio.load(html);
  const season = parseSeason($);
  const scheduleLines = richLines($, ".n-yt-kset-ja-hinnat");
  const { performances: dates, premiere } = parsePageDates(scheduleLines, season, asOf);
  const stage = stageName(scheduleLines);
  const performances: RawPerformance[] = dates.map((startsAt) => ({ startsAt, stage }));
  const duration = scheduleLines.map((line) => line.match(/kesto:?\s+(.+?)\.?$/i)?.[1]).find(Boolean);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: cleanText($("h1").first().text()) || ref.title,
    url: ref.url,
    stage,
    // The line under the title, only to classify, never stored.
    subtitle: cleanText($("h2.hero-alaotsikko").first().text()) || undefined,
    durationText: duration ? cleanText(duration) : undefined,
    ticketUrl: ticketLink($),
    premiereDate: premiere,
    runStart: performances[0]?.startsAt ?? season?.start,
    runEnd: performances.at(-1)?.startsAt ?? season?.end,
    languages: ["fi"],
    subtitleLangs: [],
    credits: parseCredits(richLines($, ".ty-ryhma-teksti")),
    performances,
    criticReviews: [],
    isVisiting: false,
    performancesPartial: false,
  });
}

export const qTeatteriAdapter: SourceAdapter = {
  id: "q-teatteri",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
