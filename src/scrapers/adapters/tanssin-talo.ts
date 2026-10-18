import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, personName } from "../text";
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
 * Tanssin talo (Kaapelitehdas): a Craft CMS site. The programme page is an empty shell
 * that its own script fills from the public GraphQL endpoint `/api`; we send the same
 * query as a GET. The listing has the categories, the organiser and every performance
 * (date and time, with year); production pages only print "Ti 15.12. klo 17" or even
 * just a date range, so performances come from the listing and the page gives stage,
 * duration, ticket link and credits.
 */
const BASE = "https://www.tanssintalo.fi";
export const API_URL = `${BASE}/api`;

/** The fields the programme page asks for, minus images. */
export const LIST_QUERY = `{ entries(section: "experiences", endDate: ">=$FROM", orderBy: "startDate asc", limit: 500, hideFromLandingPage: false) { ... on experience_Entry { id slug title url operator { title } irregularShowTimes { date time } ticketLink primaryExperienceType { title } } } }`;

/** Helsinki calendar date of an instant, "YYYY-MM-DD". */
function helsinkiDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(instant);
}

/** Entries still running on `asOf` (their end date today or later), like the programme page. */
export function listUrl(asOf: Date): string {
  return `${API_URL}?query=${encodeURIComponent(LIST_QUERY.replace("$FROM", helsinkiDate(asOf)))}`;
}

export interface ListingEntry {
  slug: string;
  title: string;
  url: string;
  /** The site's own categories ("Tanssi", "Musiikki", "Työpaja"…). */
  categories: string[];
  /** "Järjestäjä": the company that brings the show (Zodiak, Tero Saarinen Company…). */
  organisers: string[];
  showTimes: Date[];
  ticketLink?: string;
}

interface ApiEntry {
  slug?: string;
  title?: string;
  url?: string;
  operator?: Array<{ title?: string }> | null;
  irregularShowTimes?: Array<{ date?: string; time?: string }> | null;
  ticketLink?: string | null;
  primaryExperienceType?: Array<{ title?: string }> | null;
}

/** Soft hyphens ("Saas­ta­moi­nen") are layout, not part of the title. */
function cleanTitle(value: string | undefined): string {
  return cleanText((value ?? "").replace(/­/g, ""));
}

/**
 * `date` is "2026-10-27T00:00:00+02:00" and `time` "2026-06-09T18:30:00+03:00": both are
 * rendered in Helsinki time, so the calendar date of one and the wall clock of the other
 * make the start. The date part of `time` is meaningless (when the entry was edited).
 */
export function showTime(date: string | undefined, time: string | undefined): Date | null {
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(date ?? "")?.[1];
  const clock = /T(\d{2}:\d{2})/.exec(time ?? "")?.[1];
  return day && clock ? helsinkiToUtc(day, clock) : null;
}

const titles = (items: Array<{ title?: string }> | null | undefined): string[] =>
  (items ?? []).map((item) => cleanTitle(item.title)).filter(Boolean);

export function parseListing(json: string): ListingEntry[] {
  const entries = (JSON.parse(json) as { data?: { entries?: ApiEntry[] } }).data?.entries ?? [];
  return entries.flatMap((entry) => {
    if (!entry.slug || !entry.url || !entry.title) return [];
    const showTimes = (entry.irregularShowTimes ?? [])
      .map((row) => showTime(row.date, row.time))
      .filter((startsAt): startsAt is Date => startsAt !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return [{
      slug: entry.slug,
      title: cleanTitle(entry.title),
      url: entry.url,
      categories: titles(entry.primaryExperienceType),
      organisers: titles(entry.operator),
      showTimes,
      ticketLink: entry.ticketLink && /^https?:\/\//.test(entry.ticketLink) ? entry.ticketLink : undefined,
    }];
  });
}

/** Workshops, masterclasses, talks, professional events, seminars and screenings are not staged shows. */
const SKIP_CATEGORIES = /^(työpaja|ammattilaistapahtuma|taiteilijakeskustelu|seminaari|elokuva)$/i;
const SKIP_TITLES = /masterclass|työpaja|keynote|avoin toimisto|keskustelu|seminaari|kiertue|lasten lauantai/i;

export function isStagedShow(entry: ListingEntry): boolean {
  if (entry.categories.some((category) => SKIP_CATEGORIES.test(category))) return false;
  return !SKIP_TITLES.test(entry.title);
}

/** Zodiak's own programme lists its productions here too; the zodiak source owns them. */
export function isOwnedElsewhere(entry: ListingEntry): boolean {
  return entry.organisers.some((organiser) => /zodiak/i.test(organiser));
}

export function parseList(json: string): RawProduction[] {
  return parseListing(json)
    .filter((entry) => isStagedShow(entry) && !isOwnedElsewhere(entry))
    .map((entry) =>
      rawProductionSchema.parse({ externalId: entry.slug, title: entry.title, url: entry.url, isVisiting: false }),
    );
}

/** "Tanssi" wins over "Musiikki" (dance with live music); anything else is left to the classifier. */
export function typeHintFor(categories: string[]): ProductionTypeName | undefined {
  const lower = categories.map((category) => category.toLowerCase());
  if (lower.includes("tanssi")) return "DANCE";
  if (lower.includes("musiikki")) return "CONCERT";
  return undefined;
}

type Page = cheerio.CheerioAPI;

/** The "5 esitystä / Kokonaiskesto / Tila / Liput" row under the title. */
function infoRow($: Page, label: RegExp) {
  return $("#info li")
    .filter((_, element) => label.test(cleanText($(element).find("h6").first().text())))
    .first();
}

function infoText($: Page, label: RegExp): string | undefined {
  return cleanText(infoRow($, label).find("p").first().text()) || undefined;
}

function ticketLink($: Page): string | undefined {
  const own = infoRow($, /^liput$/i).find("a[href]").first().attr("href");
  const button = $("a[href]")
    .filter((_, element) => /^osta lippuja$/i.test(cleanText($(element).text())))
    .first()
    .attr("href");
  const url = own ?? button;
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** Roles we never keep: photos, graphics, production, funding, assistants, technicians. */
const SKIP_ROLE =
  /assist|apuohja|apulais|yleisötyö|harjoitutta|valokuv|^kuvat|kuvaus|graafi|tiiseri|teaser|tuotanto|tuottaja|tukija|rahoitus|hallinto|levitys|järjestäj|residenssi|yhteistuot|mentor|mukana|teknikko|ompelu|kesto|ensi-ilta|livemusiikki|musiikin ohjaa|muusikot/i;
/** "Tanssi", "Tanssi, osajako 1", "Tanssijat", "Esiintyjät", "Laulajat". */
const PERFORMER_ROLE = /^tanssi(?![a-zäöå])|tanssija|esiintyj|laulaj/i;

/** "Apuohjaaja, koreografi": each comma-separated part on its own, so the assistant part drops out. */
export function danceRoles(label: string): CreditRoleName[] {
  const roles = new Set<CreditRoleName>();
  for (const part of label.split(/\s*,\s*/)) {
    if (SKIP_ROLE.test(part)) continue;
    for (const role of mapRoleText(part)) if (role !== "OTHER") roles.add(role);
    if (PERFORMER_ROLE.test(part)) roles.add("CAST");
    // "Lavastaja" (set designer) is not in the shared role table.
    if (/lavasta/i.test(part)) roles.add("DESIGNER");
  }
  return [...roles];
}

/** Groups listed as performers ("Attitude Kids", "BAL1") and leftovers of phrases are not people. */
const NOT_A_PERSON = /\d|-$|\b(kids|junior|dancers|oppilaat|ryhmä|ensemble|orkesteri)\b/i;

/** "Pachi Sejas (Eilisen jälkeen), Delfiina Huczkowski ja feat. Elina Pirinen (FI)" → names. */
export function creditNames(value: string): string[] {
  return value
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:,|;|&|\bja\b|\bsekä\b)\s*/)
    .map((part) => cleanText(part.replace(/^(?:feat\.?|kooste)\s+/i, "").replace(/[.:]+$/, "")))
    .map((part) => (part && !NOT_A_PERSON.test(part) ? personName(part) : null))
    .filter((name): name is string => name !== null);
}

interface CreditLine {
  label: string;
  value: string;
}

/**
 * Lines of "<strong>Koreografia:</strong> Name" inside one paragraph, split at <br>.
 * Only a bold label counts, so prose with a colon in it is never read as a credit.
 */
function creditLines(paragraphHtml: string): CreditLine[] {
  const lines: CreditLine[] = [];
  let bold = false;
  let label = "";
  let value = "";
  let inValue = false;
  const finish = (): void => {
    if (inValue) lines.push({ label: cleanText(label), value: cleanText(value) });
    label = "";
    value = "";
    inValue = false;
  };
  for (const token of paragraphHtml.split(/(<\/?strong[^>]*>|<br\s*\/?>)/i)) {
    if (/^<strong/i.test(token)) bold = true;
    else if (/^<\/strong/i.test(token)) bold = false;
    else if (/^<br/i.test(token)) finish();
    else {
      const text = cheerio.load(`<div>${token}</div>`)("div").text();
      if (inValue) value += text;
      else if (bold || (label && /^\s*:/.test(text))) {
        const colon = text.indexOf(":");
        if (colon === -1) label += text;
        else {
          label += text.slice(0, colon);
          value += text.slice(colon + 1);
          inValue = true;
        }
      } else if (cleanText(text)) {
        label = "";
      }
    }
  }
  finish();
  return lines;
}

/**
 * A paragraph under an "Esiintyjät" heading lists performers one per line with no bold
 * label: "Krista-Julia Arppo (Suomi): tanssi". The name is what comes before the colon.
 */
function performerLines(heading: string, paragraphHtml: string): CreditLine[] {
  if (!PERFORMER_ROLE.test(heading) || /<strong/i.test(paragraphHtml)) return [];
  return paragraphHtml
    .split(/<br\s*\/?>/i)
    .map((line) => cleanText(cheerio.load(`<div>${line}</div>`)("div").text()).split(":")[0])
    .filter(Boolean)
    .map((value) => ({ label: heading, value }));
}

function addCredit(byName: Map<string, RawCredit>, name: string, label: string, roles: CreditRoleName[]): void {
  const known = byName.get(name);
  if (!known) {
    byName.set(name, { name, roleText: label, roles: [...roles] });
    return;
  }
  const added = roles.filter((role) => !known.roles.includes(role));
  if (added.length === 0) return;
  known.roles.push(...added);
  known.roleText = `${known.roleText}, ${label}`;
}

/**
 * Credits from every text section of the page ("Tekijät", or per piece under "Ohjelma"
 * in a mixed bill). One credit per person, with the roles of all the pieces they are in.
 */
function parseCredits($: Page): RawCredit[] {
  const byName = new Map<string, RawCredit>();
  $("article .wysiwyg p").each((_, element) => {
    const html = $(element).html() ?? "";
    const heading = cleanText($(element).prevAll("h3, h4").first().text());
    const lines = [...creditLines(html), ...performerLines(heading, html)];
    for (const line of lines) {
      const roles = danceRoles(line.label);
      if (roles.length === 0 || line.label.length > 60) continue;
      for (const name of creditNames(line.value)) addCredit(byName, name, line.label, roles);
    }
  });
  return [...byName.values()];
}

export interface DetailOptions {
  /** The production's row from the listing: performances and categories come from there. */
  listing?: ListingEntry;
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
  options: DetailOptions = {},
): RawProductionDetail {
  const $ = cheerio.load(html);
  const { listing } = options;
  const stage = infoText($, /^tila$/i);
  const performances: RawPerformance[] = (listing?.showTimes ?? []).map((startsAt) => ({ startsAt, stage }));
  const infoBox = cleanText($(".experience__info-box").text());
  const ticketUrl = ticketLink($) ?? listing?.ticketLink;

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: cleanTitle($("h1").first().text()) || ref.title,
    url: ref.url,
    stage,
    // The site's categories, only to classify, never stored.
    subtitle: listing?.categories.join(", ") || undefined,
    typeHint: listing ? typeHintFor(listing.categories) : undefined,
    durationText: infoText($, /kesto/i),
    ticketUrl,
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    languages: /\bsanaton\b|wordless/i.test(infoBox) ? ["zxx"] : [],
    subtitleLangs: [],
    credits: parseCredits($),
    performances,
    criticReviews: [],
    isVisiting: false,
  });
}

/** The listing is one request for all productions: fetch it once per run. */
let listingCache: { fetchedAt: number; entries: Promise<ListingEntry[]> } | null = null;
const LISTING_TTL_MS = 10 * 60_000;

function listing(): Promise<ListingEntry[]> {
  if (!listingCache || Date.now() - listingCache.fetchedAt > LISTING_TTL_MS) {
    const entries = politeFetch(listUrl(new Date())).then(parseListing);
    listingCache = { fetchedAt: Date.now(), entries };
  }
  return listingCache.entries;
}

export const tanssinTaloAdapter: SourceAdapter = {
  id: "tanssin-talo",
  async fetchProductions() {
    return (await listing()).filter(isStagedShow).map((entry) =>
      rawProductionSchema.parse({ externalId: entry.slug, title: entry.title, url: entry.url, isVisiting: false }),
    );
  },
  async fetchProductionDetail(ref) {
    const html = await politeFetch(ref.url);
    const entry = (await listing()).find((candidate) => candidate.slug === ref.externalId);
    return parseDetail(html, ref, { listing: entry });
  },
};
