import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, personName, slugify } from "../text";
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
 * Teatteri Avoimet Ovet: an Elementor site whose productions are plain WordPress pages
 * (REST `wp/v2/pages` mixes them with everything else, without a parent). The calendar
 * page embeds every event of the season as JSON (`data-events`, Essential Addons event
 * calendar) with full dates and the production page's URL, so it is both the list and the
 * schedule. Guest stand-up nights have no page of their own: their events link straight
 * to the ticket shop, which we keep as a link and never fetch.
 */
const BASE = "https://www.avoimetovet.fi";
export const CALENDAR_URL = `${BASE}/kalenteri/`;
const DEFAULT_STAGE = "Teatteri Avoimet Ovet";
const TICKET_HOSTS = /lippu\.fi|tiketti\.fi|ticketmaster|eventim|holvi\.com/i;

export interface CalendarEvent {
  title: string;
  startsAt: Date;
  url: string;
}

/** The `data-events` JSON of the calendar widget; start is Helsinki wall-clock "2026-09-08 18:30". */
export function parseCalendar(html: string): CalendarEvent[] {
  const $ = cheerio.load(html);
  const events: CalendarEvent[] = [];
  $("[data-events]").each((_, element) => {
    const data: unknown = JSON.parse($(element).attr("data-events") ?? "[]");
    if (!Array.isArray(data)) return;
    for (const item of data as Array<Record<string, unknown>>) {
      const start = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(item.start ?? ""));
      const url = String(item.url ?? "");
      const title = cleanText(String(item.title ?? ""));
      if (!start || !/^https?:\/\//.test(url) || !title) continue;
      events.push({ title, startsAt: helsinkiToUtc(start[1], start[2]), url });
    }
  });
  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** "Soteorpo ENSI-ILTA", "Soteorpo (ikärajaton)" → "Soteorpo". */
export function baseTitle(eventTitle: string): string {
  return cleanText(eventTitle.replace(/\([^)]*\)/g, "").replace(/\b(?:ENSI-ILTA|ENNAKKO)\b/g, ""));
}

function isOwnPage(url: string): boolean {
  return new URL(url).host === new URL(BASE).host;
}

/** A production page's slug ("https://www.avoimetovet.fi/magdag/" → "magdag"). */
function slugFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
}

/** Events without a page of their own (ticket-shop links) are grouped by title instead. */
function eventKey(event: CalendarEvent): string {
  return isOwnPage(event.url) ? slugFromUrl(event.url) : slugify(baseTitle(event.title));
}

export function eventsFor(events: CalendarEvent[], ref: Pick<RawProduction, "externalId">): CalendarEvent[] {
  return events.filter((event) => eventKey(event) === ref.externalId);
}

/** Page URLs under "VIERAILUOHJELMISTO" in the main menu. */
function visitingUrls($: cheerio.CheerioAPI): Set<string> {
  const urls = new Set<string>();
  $('#menu-paavalikko a[href*="/vierailuohjelmisto/"]')
    .closest("li")
    .find(".sub-menu a[href]")
    .each((_, element) => {
      urls.add(slugFromUrl($(element).attr("href") ?? ""));
    });
  return urls;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** One production per production page in the calendar, plus one per title for guest nights. */
export function parseList(calendarHtml: string): RawProduction[] {
  const visiting = visitingUrls(cheerio.load(calendarHtml));
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of parseCalendar(calendarHtml)) {
    const key = eventKey(event);
    if (key) groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([externalId, events]) => {
    const ownPage = isOwnPage(events[0].url);
    return rawProductionSchema.parse({
      externalId,
      title: mostCommon(events.map((event) => baseTitle(event.title))),
      url: ownPage ? events[0].url : CALENDAR_URL,
      isVisiting: ownPage ? visiting.has(externalId) : true,
    });
  });
}

function performancesOf(events: CalendarEvent[]): RawPerformance[] {
  const byTime = new Map<number, RawPerformance>();
  for (const event of events) {
    byTime.set(event.startsAt.getTime(), {
      startsAt: event.startsAt,
      stage: DEFAULT_STAGE,
      ticketUrl: isOwnPage(event.url) ? undefined : event.url,
    });
  }
  return [...byTime.values()];
}

function premiereOf(events: CalendarEvent[]): Date | undefined {
  const premiere = events.find((event) => /ENSI-ILTA/i.test(event.title))?.startsAt;
  if (!premiere) return undefined;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" })
    .format(premiere)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Producers, poster and photo credits, teacher's guides: not artistic credits. */
const SKIPPED_ROLES = /tuotanto|^pr$|juliste|kuva|graafikko|opas\b|lärarhandledning/i;

/**
 * Labels mapRoleText misreads on this site: "Näyttelijät", "Esiintyjät", the typo
 * "esnsemble", "Lapsen ääni" (a voice part, not sound design), "alkuperäisromaani".
 */
const ROLE_OVERRIDES: Array<[RegExp, CreditRoleName]> = [
  [/näyttelij|esiintyj|nsemble|(?:^|\s)ääni$/i, "CAST"],
  [/alkuperäis/i, "WRITER"],
];

function rolesFor(roleText: string): CreditRoleName[] {
  const override = ROLE_OVERRIDES.find(([pattern]) => pattern.test(roleText));
  return override ? [override[1]] : mapRoleText(roleText);
}

/**
 * Lines like "dramatisointi ja ohjaus <strong>Hanna Kirjavainen</strong>" or
 * "rooleissa <strong>A</strong> ja <strong>B</strong>": a short role label, then only
 * bold names and separators. Body text has bold names too, but with prose around them.
 */
export function creditsFromLine(fragmentHtml: string): RawCredit[] {
  const $ = cheerio.load(`<div>${fragmentHtml}</div>`);
  const text = cleanText($("div").text());
  const names = $("strong")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter((name) => /\p{L}/u.test(name));
  if (names.length === 0) return [];
  const start = text.indexOf(names[0]);
  const roleText = cleanText(text.slice(0, start));
  if (!/^\p{L}[\p{L}\s/.,-]{1,60}$/u.test(roleText) || SKIPPED_ROLES.test(roleText)) return [];
  let rest = text.slice(start);
  for (const name of names) rest = rest.replace(name, " ");
  if (!/^(?:[\s,&]|\bja\b|\boch\b)*$/.test(rest)) return [];
  const roles = rolesFor(roleText);
  if (roles.length === 0) return [];
  return names
    .map((name) => personName(name))
    .filter((name): name is string => name !== null)
    .map((name) => ({ name, roleText, roles }));
}

function parseCredits($: cheerio.CheerioAPI): RawCredit[] {
  const credits: RawCredit[] = [];
  $('[data-elementor-type="wp-page"] .elementor-widget-text-editor p').each((_, element) => {
    for (const fragment of ($(element).html() ?? "").split(/<br\s*\/?>/i)) {
      credits.push(...creditsFromLine(fragment));
    }
  });
  return credits;
}

function pageTitle($: cheerio.CheerioAPI, fallback: string): string {
  const og = cleanText(($('meta[property="og:title"]').attr("content") ?? "").replace(/\s*\|\s*Teatteri Avoimet Ovet$/, ""));
  return og || fallback;
}

/** The tagline after the title ("Monologinäytelmä vallasta…"), only to classify, never stored. */
function taglineOf($: cheerio.CheerioAPI): string | undefined {
  const headings = $('[data-elementor-type="wp-page"]').find("h1, h2").toArray();
  const afterTitle = headings.slice(headings.findIndex((element) => element.tagName === "h1") + 1);
  const tagline = afterTitle
    .filter((element) => element.tagName === "h2")
    .map((element) => cleanText($(element).text()))
    .find((text) => text.length > 0 && !/\d/.test(text));
  return tagline || undefined;
}

/** "Kesto n. 2 h 10 min sis. väliajan. Myöhästyneet…" → "n. 2 h 10 min sis. väliajan". */
function durationOf($: cheerio.CheerioAPI): string | undefined {
  const paragraph = $('[data-elementor-type="wp-page"] p')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .find((text) => /^kesto\s/i.test(text));
  if (!paragraph) return undefined;
  const value = paragraph.replace(/^kesto\s+/i, "").split(/\.\s+(?=\p{Lu})/u)[0];
  return cleanText(value.replace(/\.$/, "")) || undefined;
}

/** "Esitys on ruotsiksi suomenkielisillä osioilla." → ["sv", "fi"]; Finnish otherwise. */
function languagesOf($: cheerio.CheerioAPI): string[] {
  const text = cleanText($('[data-elementor-type="wp-page"]').text());
  const sentence = /Esitys on (\p{L}+ksi[^.]*)/u.exec(text)?.[1];
  const codes = sentence ? languageCodes(sentence) : [];
  return codes.length > 0 ? codes : ["fi"];
}

function ticketLinkOf($: cheerio.CheerioAPI): string | undefined {
  return $('[data-elementor-type="wp-page"] a[href]')
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .find((href) => /^https?:\/\//.test(href) && TICKET_HOSTS.test(new URL(href).host));
}

function scheduleFacts(events: CalendarEvent[]) {
  const performances = performancesOf(events);
  return {
    stage: DEFAULT_STAGE,
    premiereDate: premiereOf(events),
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    performances,
    subtitleLangs: [],
    criticReviews: [],
    performancesPartial: false,
  };
}

/** A production page plus its calendar events. */
export function parseDetail(html: string, ref: RawProduction, events: CalendarEvent[]): RawProductionDetail {
  const $ = cheerio.load(html);
  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: pageTitle($, ref.title),
    url: ref.url,
    subtitle: taglineOf($),
    durationText: durationOf($),
    ticketUrl: ticketLinkOf($),
    languages: languagesOf($),
    credits: parseCredits($),
    isVisiting: ref.isVisiting,
    ...scheduleFacts(eventsFor(events, ref)),
  });
}

/** A guest night with no page of its own: everything we know is in the calendar. */
export function detailFromCalendar(ref: RawProduction, events: CalendarEvent[]): RawProductionDetail {
  const own = eventsFor(events, ref);
  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: ref.title,
    url: ref.url,
    ticketUrl: own.find((event) => !isOwnPage(event.url))?.url,
    languages: ["fi"],
    credits: [],
    isVisiting: ref.isVisiting,
    ...scheduleFacts(own),
  });
}

/** The calendar is one page for all productions: fetch it once per run. */
let calendarCache: { fetchedAt: number; html: Promise<string> } | null = null;
const CALENDAR_TTL_MS = 10 * 60_000;

function calendar(): Promise<string> {
  if (!calendarCache || Date.now() - calendarCache.fetchedAt > CALENDAR_TTL_MS) {
    const html = politeFetch(CALENDAR_URL);
    html.catch(() => {
      calendarCache = null;
    });
    calendarCache = { fetchedAt: Date.now(), html };
  }
  return calendarCache.html;
}

export const avoimetOvetAdapter: SourceAdapter = {
  id: "avoimet-ovet",
  async fetchProductions() {
    return parseList(await calendar());
  },
  async fetchProductionDetail(ref) {
    const events = parseCalendar(await calendar());
    if (!isOwnPage(ref.url) || ref.url === CALENDAR_URL) return detailFromCalendar(ref, events);
    return parseDetail(await politeFetch(ref.url), ref, events);
  },
};
