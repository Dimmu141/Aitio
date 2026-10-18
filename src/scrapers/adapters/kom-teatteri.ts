import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc } from "../text";
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

export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $("main article").each((_, element) => {
    const article = $(element);
    const url = article.find('a[href*="/ohjelmisto/"]').last().attr("href");
    const title = cleanText(article.find("h1").first().text().replace(/­/g, ""));
    if (!url || !title) return;
    const externalId = slugFromUrl(url);
    if (!externalId || externalId === "kalenteri") return;
    results.set(externalId, rawProductionSchema.parse({ externalId, title, url, isVisiting: false }));
  });
  return [...results.values()];
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

/** "LOKAKUU 2026" headings followed by "to 1.10. klo 18.30 (ensi-ilta)" and "la 31.10. klo 13.00 ja 18.30". */
export function parsePageDates(text: string): PageDates {
  const result: PageDates = { performances: [] };
  let year: number | null = null;
  for (const line of text.split(/\n/).map(cleanText)) {
    const heading = line.toLowerCase().match(/^([a-zäö]+kuu)\s+(\d{4})$/);
    if (heading && MONTHS[heading[1]]) {
      year = Number(heading[2]);
      continue;
    }
    const match = line.match(/(\d{1,2})\.(\d{1,2})\.\s*klo\s+([\d.:]+(?:\s*(?:ja|&|,)\s*[\d.:]+)*)/i);
    if (!match || !year) continue;
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

/** Lines like "Ohjaus <strong>Erkki Saarela</strong>": a short role, then the name in bold at the end. */
function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $("main p").each((_, element) => {
    for (const fragment of ($(element).html() ?? "").split(/<br\s*\/?>/i)) {
      const line = cheerio.load(`<div>${fragment}</div>`);
      const name = cleanText(line("strong").last().text());
      const text = cleanText(line("div").text());
      if (!name || !text.endsWith(name)) continue;
      const roleText = cleanText(text.slice(0, -name.length));
      if (roleText.length < 3 || roleText.length > 40) continue;
      const roles = mapRoleText(roleText);
      if (roles.length > 0 && !(roles.length === 1 && roles[0] === "OTHER")) credits.push({ name, roleText, roles });
    }
  });
  return credits;
}

/** A quote followed by "– Selina Keränen / Apu" linking to the review; we keep only the link facts. */
function parseReviews($: Page): RawCriticReview[] {
  const reviews: RawCriticReview[] = [];
  $("main a").each((_, element) => {
    const text = cleanText($(element).text());
    const url = $(element).attr("href");
    const match = text.match(/^[–-]\s*(.+?)\s*\/\s*(.+)$/);
    if (!match || !url?.startsWith("http")) return;
    reviews.push({ outlet: match[2], critic: match[1], url });
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
    .find("p, h1, h2, h3, blockquote")
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
  const premiereText = decoded.match(/ensi-ilta\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: properTitle($, ownRows.map((row) => row.show)),
    url: ref.url,
    stage: performances.find((performance) => performance.stage)?.stage ?? DEFAULT_STAGE,
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
