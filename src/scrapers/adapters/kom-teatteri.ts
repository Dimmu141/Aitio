import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, splitPeople } from "../text";
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
 * KOM-teatteri: hand-edited WordPress pages without structured markup. The repertoire
 * page links the current productions; each production page lists its own dates under
 * month headings, and the site-wide calendar adds venue and per-show ticket links.
 * Both lists are maintained by hand, so we merge them by start time.
 */
const BASE = "https://kom-teatteri.fi";
export const LIST_URL = `${BASE}/ohjelmisto/`;
export const CALENDAR_URL = `${BASE}/ohjelmisto/kalenteri/`;
const DEFAULT_STAGE = "KOM-teatteri";

const MONTHS: Record<string, number> = {
  tammikuu: 1, helmikuu: 2, maaliskuu: 3, huhtikuu: 4, toukokuu: 5, kesäkuu: 6,
  heinäkuu: 7, elokuu: 8, syyskuu: 9, lokakuu: 10, marraskuu: 11, joulukuu: 12,
};

/** Soft hyphens and case aside, so "POIS­KAT­SO­JAT" matches "Poiskatsojat". */
export function normaliseTitle(title: string): string {
  return cleanText(title.replace(/­/g, ""))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slugFromUrl(url: string): string {
  return url.replace(/^.*\/ohjelmisto\//, "").replace(/[/?#].*$/, "");
}

/** Film screenings and reading nights share the repertoire page; they are not theatre. */
const NOT_A_PRODUCTION = /elokuv|lukureiv/i;

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  // null keeps a skipped card's link taken.
  const results = new Map<string, RawProduction | null>();
  $("main article").each((_, element) => {
    const article = $(element);
    const url = article.find('a[href*="/ohjelmisto/"]').last().attr("href");
    const title = cleanText(article.find("h1").first().text().replace(/­/g, ""));
    if (!url || !title) return;
    const externalId = slugFromUrl(url);
    // The first card wins: a later card can link to the wrong page (Lukureivit → NAZA, Oct 2026).
    if (!externalId || externalId === "kalenteri" || results.has(externalId)) return;
    const skip = NOT_A_PRODUCTION.test(article.text().replace(/­/g, ""));
    results.set(externalId, skip ? null : rawProductionSchema.parse({ externalId, title, url, isVisiting: false }));
  });
  return [...results.values()].filter((production): production is RawProduction => production !== null);
}

export interface CalendarRow {
  startsAt: Date;
  show: string;
  venue: string;
  ticketUrl?: string;
}

/** "ma 12.10.2026" + "18.30" → instant; venue without its street address. */
export function parseCalendar(html: string): CalendarRow[] {
  const $ = cheerio.load(html);
  const rows: CalendarRow[] = [];
  $(".kom_calendar .row").each((_, element) => {
    const row = $(element);
    const date = cleanText(row.find(".date").text()).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    const time = cleanText(row.find(".time").text()).match(/(\d{1,2})[.:](\d{2})/);
    if (!date || !time) return;
    rows.push({
      startsAt: helsinkiToUtc(
        `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`,
        `${time[1].padStart(2, "0")}:${time[2]}`,
      ),
      show: cleanText(row.find(".show").text()),
      venue: cleanText(row.find(".venue").text().replace(/\(.*\)/, "")),
      ticketUrl: row.find(".tickets a").attr("href") || undefined,
    });
  });
  return rows;
}

interface PageDates {
  performances: Date[];
  premiere?: Date;
}

/**
 * "LOKAKUU 2026" headings followed by "to 1.10. klo 18.30 (ensi-ilta)", "la 31.10. klo 13.00
 * ja 18.30" or, without "klo", "pe 23.10. 18.30 (+teosesittely klo 17.45 …)". Only lines
 * that start with a weekday, so a talk's "klo 17.45" is never a show; "PERUTTU" is dropped.
 */
export function parsePageDates(text: string): PageDates {
  const result: PageDates = { performances: [] };
  let year: number | null = null;
  for (const line of text.split(/\n/).map(cleanText)) {
    const heading = line.toLowerCase().match(/^([a-zäö]+kuu)\s+(\d{4})$/);
    if (heading && MONTHS[heading[1]]) {
      year = Number(heading[2]);
      continue;
    }
    const match = line.match(
      /^(?:ma|ti|ke|to|pe|la|su)\s+(\d{1,2})\.(\d{1,2})\.\s*(?:klo\s+)?(\d{1,2}[.:]\d{2}(?:\s*(?:ja|&|,)\s*\d{1,2}[.:]\d{2})*)/i,
    );
    if (!match || !year || /\bperu(?:ttu|tettu)\b/i.test(line)) continue;
    const [, day, month, times] = match;
    for (const time of times.split(/\s*(?:ja|&|,)\s*/)) {
      const [hours, minutes] = time.split(/[.:]/);
      if (!minutes) continue;
      const startsAt = helsinkiToUtc(
        `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
        `${hours.padStart(2, "0")}:${minutes}`,
      );
      result.performances.push(startsAt);
      if (/ensi-ilta/i.test(line) && !result.premiere) result.premiere = startsAt;
    }
  }
  return result;
}

/** The page's own dates, with venue and ticket link from the calendar where it has them. */
export function mergePerformances(pageDates: Date[], calendar: CalendarRow[]): RawPerformance[] {
  const byTime = new Map<number, RawPerformance>();
  for (const startsAt of pageDates) byTime.set(startsAt.getTime(), { startsAt, stage: DEFAULT_STAGE });
  for (const row of calendar) {
    byTime.set(row.startsAt.getTime(), { startsAt: row.startsAt, stage: row.venue || DEFAULT_STAGE, ticketUrl: row.ticketUrl });
  }
  return [...byTime.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

type Page = cheerio.CheerioAPI;

/**
 * Lines like "Ohjaus <strong>Erkki Saarela</strong>" or "Näyttämöllä <strong>A</strong>,
 * <strong>B</strong> ja <strong>C</strong>": a short role, then the names from the first
 * bold word on. Empty <strong>s around <br>s are common, so only bold text counts.
 */
function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $("main p").each((_, element) => {
    for (const fragment of ($(element).html() ?? "").split(/<br\s*\/?>/i)) {
      const line = cheerio.load(`<div>${fragment}</div>`);
      const firstName = line("strong")
        .map((_, strong) => cleanText(line(strong).text()))
        .get()
        .find(Boolean);
      const text = cleanText(line("div").text());
      const start = firstName ? text.indexOf(firstName) : -1;
      if (start < 0) continue;
      const roleText = cleanText(text.slice(0, start));
      if (roleText.length < 3 || roleText.length > 40) continue;
      const roles = mapRoleText(roleText);
      if (roles.length === 0 || (roles.length === 1 && roles[0] === "OTHER")) continue;
      for (const name of splitPeople(text.slice(start))) credits.push({ name, roleText, roles });
    }
  });
  return credits;
}

/**
 * A quote followed by a link to the review; we keep only the link facts. Two bylines:
 * "– Selina Keränen / Apu" (critic first) and "Helsingin Sanomat / Maria Säkö" (outlet first).
 */
function parseReviews($: Page): RawCriticReview[] {
  const reviews: RawCriticReview[] = [];
  $("main a").each((_, element) => {
    const text = cleanText($(element).text());
    const url = $(element).attr("href");
    if (!url?.startsWith("http") || url.startsWith(BASE) || /lippu\.fi/.test(url)) return;
    const criticFirst = text.match(/^[–-]\s*(.+?)\s*\/\s*(.+)$/);
    const outletFirst = text.match(/^(\p{Lu}[^/]{1,40}?)\s*\/\s*(\p{Lu}[^/]{1,40})$/u);
    if (criticFirst) reviews.push({ outlet: criticFirst[2], critic: criticFirst[1], url });
    else if (outletFirst) reviews.push({ outlet: outletFirst[1], critic: outletFirst[2], url });
  });
  return reviews;
}

/** The heading is in capitals; take the calendar's or og:title's casing when it is the same title. */
function properTitle($: Page, calendarShows: string[]): string {
  const heading = cleanText($("main h1").first().text().replace(/­/g, ""));
  const wanted = normaliseTitle(heading);
  const ogTitle = cleanText(($('meta[property="og:title"]').attr("content") ?? "").split(" – ")[0]);
  const candidates = [...calendarShows, ogTitle];
  return candidates.find((candidate) => normaliseTitle(candidate) === wanted) ?? heading;
}

export function parseDetail(
  html: string,
  calendarHtml: string | null,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
): RawProductionDetail {
  const $ = cheerio.load(html);
  const mainText = $("main")
    // Month headings can be <h4>s with the dates in a sibling div.paragraph (Poiskatsojat).
    .find("p, h1, h2, h3, h4, blockquote, div.paragraph")
    .map((_, element) => $(element).html() ?? "")
    .get()
    .join("\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decoded = cheerio.load(`<div>${mainText}</div>`)("div").text();
  const pageDates = parsePageDates(decoded);
  const calendar = calendarHtml ? parseCalendar(calendarHtml) : [];
  const wanted = normaliseTitle(ref.title);
  const ownRows = calendar.filter((row) => normaliseTitle(row.show) === wanted);
  const performances = mergePerformances(pageDates.performances, ownRows);
  // "OSTA LIPUT" exactly: the link next to it sells interval refreshments.
  const ticketUrl = $("main a[href]")
    .filter((_, element) => /^osta liput$/i.test(cleanText($(element).text())))
    .first()
    .attr("href");
  const premiereText = decoded.match(/ensi-ilta\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: properTitle($, ownRows.map((row) => row.show)),
    url: ref.url,
    stage: performances.find((performance) => performance.stage)?.stage ?? DEFAULT_STAGE,
    ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    // The tagline under the title, only to classify ("Konsertissa kuullaan…"), never stored.
    subtitle: cleanText($("main h2, main h3").first().text()) || undefined,
    durationText: cleanText(decoded.match(/kesto\s+(?:on\s+)?([^.]+)/i)?.[1] ?? "") || undefined,
    premiereDate: premiereText
      ? new Date(Date.UTC(Number(premiereText[3]), Number(premiereText[2]) - 1, Number(premiereText[1])))
      : pageDates.premiere,
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    languages: ["fi"],
    subtitleLangs: [],
    credits: parseCredits($),
    performances,
    criticReviews: parseReviews($),
    isVisiting: false,
  });
}

/** The calendar is one page for all productions: fetch it once per run. */
let calendarCache: { fetchedAt: number; html: Promise<string> } | null = null;
const CALENDAR_TTL_MS = 10 * 60_000;

function calendar(): Promise<string> {
  if (!calendarCache || Date.now() - calendarCache.fetchedAt > CALENDAR_TTL_MS) {
    calendarCache = { fetchedAt: Date.now(), html: politeFetch(CALENDAR_URL) };
  }
  return calendarCache.html;
}

export const komTeatteriAdapter: SourceAdapter = {
  id: "kom-teatteri",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    const html = await politeFetch(ref.url);
    const calendarHtml = await calendar().catch(() => null);
    return parseDetail(html, calendarHtml, ref);
  },
};
