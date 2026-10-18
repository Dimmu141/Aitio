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
 * Teatteri Takomo: a WordPress theme with a `shows` post type. The REST API exposes the
 * posts but not their performances, so we read the server HTML. /ohjelmisto/ is a
 * calendar of upcoming performances (past productions move to /ohjelmistoarkisto/);
 * each production page lists all its performances as `.show` rows ("su 18.10. klo
 * 12.00", no year) with a Tiketti link per row, which we store but never fetch.
 * The venue is not in the rows: off-site productions say it in their text
 * ("Esitys tapahtuu Teatterimuseossa"), so we match known venues there.
 */
const BASE = "https://teatteritakomo.fi";
export const LIST_URL = `${BASE}/ohjelmisto/`;
export const HOME_STAGE = "Teatteri Takomo";

/** Events on the calendar that are not performances. */
const NOT_A_PERFORMANCE = /levynkuuntelu|työpaja|workshop|open call|avoin haku|haku auki|uutiskirje/i;

/** Off-site venues Takomo has played, matched in a row title or the production's text. */
const KNOWN_VENUES: Array<[RegExp, string]> = [
  [/hanasaar/i, "Hanasaaren voimala"],
  [/teatterimuseo/i, "Teatterimuseo"],
  [/kansallisteatter/i, "Kansallisteatteri"],
  [/kaapelitehta/i, "Kaapelitehdas"],
  [/teatterikesä/i, "Tampereen Teatterikesä"],
];

type Page = cheerio.CheerioAPI;

/** "https://teatteritakomo.fi/ohjelmisto/962/" → "962" */
function slugFromUrl(url: string): string {
  return url.replace(/^.*\/ohjelmisto\//, "").replace(/[/?#].*$/, "");
}

/** One entry per production linked from the calendar, in calendar order. */
export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  $(".shows .show .show-title a[href]").each((_, element) => {
    const url = $(element).attr("href") ?? "";
    const title = cleanText($(element).text());
    if (!url.startsWith(`${BASE}/ohjelmisto/`) || !title || NOT_A_PERFORMANCE.test(title)) return;
    const externalId = slugFromUrl(url);
    if (!externalId || results.has(externalId)) return;
    results.set(externalId, rawProductionSchema.parse({ externalId, title, url, isVisiting: false }));
  });
  return [...results.values()];
}

/** The first known venue named in the text, if any. */
export function venueIn(text: string): string | undefined {
  return KNOWN_VENUES.find(([pattern]) => pattern.test(text))?.[1];
}

/**
 * The production's own venue: a sentence in its text that says where it "takes place"
 * ("tapahtuu … Hanasaaren … sosiaalirakennuksessa"), else Takomo itself.
 */
function productionVenue(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n/).filter((sentence) => /tapahtuu|järjestetään|huom/i.test(sentence));
  for (const sentence of sentences) {
    const venue = venueIn(sentence);
    if (venue) return venue;
  }
  return HOME_STAGE;
}

/** "su 18.10. klo 12.00" → instant, with the year from the weekday near `asOf`; null if none fits. */
export function parseShowDate(text: string, asOf: Date): Date | null {
  const match = cleanText(text).match(/^([a-zäö]{2})\s+(\d{1,2})\.(\d{1,2})\.\s*(?:klo\s*)?(\d{1,2})[.:](\d{2})/i);
  if (!match) return null;
  const [, weekday, day, month, hours, minutes] = match;
  const year = yearFromWeekday(Number(day), Number(month), weekday, asOf);
  if (year === null) return null;
  return helsinkiToUtc(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, `${hours.padStart(2, "0")}:${minutes}`);
}

/**
 * The page's `.show` rows. A row whose title differs from the production's can name its
 * venue ("Jumppatytöt Kansallisteatterissa"). Two rows at one time are ticket variants
 * (KAE9's three- and nine-hour tickets), so we keep one performance per start time.
 */
function parsePerformances($: Page, title: string, defaultStage: string, asOf: Date): RawPerformance[] {
  const byTime = new Map<number, RawPerformance>();
  $(".shows .show").each((_, element) => {
    const row = $(element);
    const startsAt = parseShowDate(row.find(".show-date").text(), asOf);
    if (!startsAt || byTime.has(startsAt.getTime())) return;
    const rowTitle = cleanText(row.find(".show-title").text());
    const stage = (rowTitle !== title && venueIn(rowTitle)) || defaultStage;
    const ticketUrl = row.find(".show-ticket a[href]").attr("href");
    byTime.set(startsAt.getTime(), {
      startsAt,
      stage,
      ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    });
  });
  return [...byTime.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Photo, poster, production and funding lines are not artistic credits; nor are facts like length. */
const NOT_A_CREDIT =
  /^(?:esitys)?kuva(?:t)?$|^photo|juliste|poster|art piece|tuotanto$|^production$|tour manager|teknikko|yhteistyö|cooperation|tuki|support|kesto|length|kieli|language|ikä|^age|sisältö|content/i;

/** Takomo's labels that `mapRoleText` doesn't know: "Näytelmä", "Näyttelijät", "esiintyminen", English ones. */
function rolesFor(roleText: string): CreditRoleName[] {
  const roles = new Set(mapRoleText(roleText));
  const text = roleText.toLowerCase();
  if (/^näytelmä|writer/.test(text)) roles.add("WRITER");
  if (/näyttelij|esiint|performance|performer|\bcast\b/.test(text)) roles.add("CAST");
  if (/directing|director/.test(text) && !/assist/.test(text)) roles.add("DIRECTOR");
  if (roles.size > 1) roles.delete("OTHER");
  return [...roles];
}

/** "Ella Lahdenmäki ja Tapio Viitasaari", "Noora Dadu,\nMinttu Mustakallio" → names. */
function splitNames(text: string): string[] {
  return text
    .split(/,|\n|\s+ja\s+|\s+&\s+|\s+and\s+/)
    .map((part) => personName(part))
    .filter((name): name is string => name !== null && !/^(?:työryhmä|working group)$/i.test(name));
}

function credit(name: string, roleText: string): RawCredit | null {
  if (NOT_A_CREDIT.test(roleText) || roleText.length > 160) return null;
  const roles = rolesFor(roleText);
  // A label we can't place, with a one-word "name", is a group or a phrase (Kaksoisolento).
  if (roles.length === 0 || (roles[0] === "OTHER" && roles.length === 1 && !name.includes(" "))) return null;
  return { name, roleText, roles };
}

/** HTML as text, with <br> kept as newlines. */
function htmlText(html: string): string {
  return cheerio
    .load(`<div>${html.replace(/<br\s*\/?>/gi, "\n")}</div>`)("div")
    .text()
    .split("\n")
    .map(cleanText)
    .filter(Boolean)
    .join("\n");
}

/**
 * "Role: names" lines, one per <br>. A role cut by a line break ends in a comma
 * ("…äänisuunnittelu,<br>videoarkisto…: names"), and names can start on the next line.
 */
function colonCredits(text: string): RawCredit[] {
  const entries: Array<{ roleText: string; names: string }> = [];
  let carry = "";
  for (const line of text.split("\n")) {
    const joined = carry ? `${carry} ${line}` : line;
    carry = "";
    const colon = joined.indexOf(":");
    if (colon > 0) entries.push({ roleText: cleanText(joined.slice(0, colon)), names: joined.slice(colon + 1) });
    else if (joined.endsWith(",") && entries.at(-1)?.names.trim() !== "") carry = joined;
    else if (entries.length > 0) entries[entries.length - 1].names += `\n${joined}`;
  }
  return entries.flatMap(({ roleText, names }) => splitNames(names).flatMap((name) => credit(name, roleText) ?? []));
}

/** One paragraph in one of the site's formats: "Role: names", "Role <b>names</b>", "Name, role". */
function paragraphCredits(html: string, boldHtml: string | null): RawCredit[] {
  const text = htmlText(html);
  if (text.includes(":")) return colonCredits(text);
  const flat = cleanText(text);
  const bold = boldHtml === null ? "" : cleanText(htmlText(boldHtml));
  if (bold && flat.endsWith(bold) && flat.length > bold.length) {
    const roleText = cleanText(flat.slice(0, -bold.length));
    return splitNames(htmlText(boldHtml ?? "")).flatMap((name) => credit(name, roleText) ?? []);
  }
  const nameThenRole = flat.match(/^([^,]+),\s*(\p{Ll}[^,]*)$/u);
  const name = nameThenRole ? personName(nameThenRole[1]) : null;
  const found = name && nameThenRole ? credit(name, nameThenRole[2]) : null;
  return found ? [found] : [];
}

/** The `.credits` box. A bare "Työryhmä" heading is followed by a paragraph of names alone. */
export function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  let underWorkingGroup = false;
  $(".credits p").each((_, element) => {
    const html = $(element).html() ?? "";
    const text = htmlText(html);
    if (/^(?:työryhmä|working group)$/i.test(text)) {
      underWorkingGroup = true;
      return;
    }
    if (underWorkingGroup && !text.includes(":") && !text.includes(",")) {
      for (const name of splitNames(text)) credits.push({ name, roleText: "Työryhmä", roles: ["OTHER"] });
    } else {
      credits.push(...paragraphCredits(html, $(element).find("b, strong").last().html()));
    }
    underWorkingGroup = false;
  });
  return withoutRedundantOther(credits);
}

/** Massif lists its team in English and Finnish: drop "OTHER" for a name that also has a real role. */
function withoutRedundantOther(credits: RawCredit[]): RawCredit[] {
  const placed = new Set(credits.filter((item) => !item.roles.includes("OTHER")).map((item) => item.name));
  return credits.filter((item) => !(item.roles.includes("OTHER") && placed.has(item.name)));
}

/** "Kieli: suomi" when stated; "ei ongelmaa" / "no problem" means no spoken language to name. */
function spokenLanguages(text: string): string[] {
  const stated = text.match(/(?:^|\n)\s*(?:esitys)?kieli:?\s*([^\n]+)/i)?.[1];
  if (!stated) return ["fi"];
  return languageCodes(stated);
}

export function parseDetail(
  html: string,
  ref: Pick<RawProduction, "externalId" | "url" | "title">,
  asOf: Date = new Date(),
): RawProductionDetail {
  const $ = cheerio.load(html);
  const title = cleanText($("article h1.entry-title").first().text()) || ref.title;
  const text = $(".entry-content p, .entry-content div, .credits p")
    .map((_, element) => htmlText($(element).html() ?? ""))
    .get()
    .join("\n");
  const stage = productionVenue(text);
  const performances = parsePerformances($, title, stage, asOf);
  const premiere = text.match(/ensi-ilta\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title,
    url: ref.url,
    stage,
    durationText: cleanText(text.match(/kesto\s+(?:on\s+)?([^.\n]+)/i)?.[1] ?? "") || undefined,
    premiereDate: premiere
      ? new Date(Date.UTC(Number(premiere[3]), Number(premiere[2]) - 1, Number(premiere[1])))
      : undefined,
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    languages: spokenLanguages(text),
    subtitleLangs: [],
    credits: parseCredits($),
    performances,
    criticReviews: [],
    isVisiting: false,
  });
}

export const takomoAdapter: SourceAdapter = {
  id: "takomo",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
