import * as cheerio from "cheerio";
import { z } from "zod";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, helsinkiWeekday, languageCodes, weekdaysIn } from "../text";
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
 * Ryhmäteatteri: productions are the WordPress post type "artist". The REST list returns
 * a Finnish and an English post for the same production; we keep the Finnish one.
 * Production pages are server-rendered, including the Tiketti performance list grouped
 * under month headings ("lokakuu 2026"), which also gives us the year.
 */
const BASE = "https://www.ryhmateatteri.fi";

export function listUrl(page: number): string {
  return `${BASE}/wp-json/wp/v2/artist?per_page=100&page=${page}&_fields=id,title,link,modified`;
}

const restItemSchema = z.object({
  id: z.number(),
  link: z.url(),
  title: z.object({ rendered: z.string() }),
});

export function parseRestList(json: string): RawProduction[] {
  const items = z.array(z.unknown()).parse(JSON.parse(json));
  const results: RawProduction[] = [];
  for (const item of items) {
    const parsed = restItemSchema.safeParse(item);
    if (!parsed.success || parsed.data.link.includes("/en/")) continue;
    results.push(
      rawProductionSchema.parse({
        externalId: String(parsed.data.id),
        title: cleanText(cheerio.load(parsed.data.title.rendered).text()),
        url: parsed.data.link,
        isVisiting: false,
      }),
    );
  }
  return results;
}

type Page = cheerio.CheerioAPI;

const MONTHS: Record<string, number> = {
  tammikuu: 1, helmikuu: 2, maaliskuu: 3, huhtikuu: 4, toukokuu: 5, kesäkuu: 6,
  heinäkuu: 7, elokuu: 8, syyskuu: 9, lokakuu: 10, marraskuu: 11, joulukuu: 12,
};

interface SubtitleRule {
  langs: string[];
  /** Weekdays (0 = Sunday) the subtitles apply to; empty means every performance. */
  weekdays: number[];
}

/** "Tekstitys englanniksi ja selkeällä suomen kielellä keskiviikkoisin ja perjantaisin." */
export function parseSubtitleRule(text: string): SubtitleRule | null {
  const sentence = text.match(/tekstitys[^.]*/i)?.[0];
  if (!sentence) return null;
  const langs = languageCodes(sentence);
  return langs.length > 0 ? { langs, weekdays: weekdaysIn(sentence) } : null;
}

/** Performances under their month headings; the heading carries the year. */
function parsePerformances($: Page, subtitles: SubtitleRule | null): RawPerformance[] {
  const performances: RawPerformance[] = [];
  let year: number | null = null;
  let month: number | null = null;
  $(".tiketti-events-list")
    .first()
    .children()
    .each((_, element) => {
      const node = $(element);
      if (node.is("h2.month")) {
        const [name, yearText] = cleanText(node.text()).toLowerCase().split(" ");
        month = MONTHS[name] ?? null;
        year = Number(yearText) || null;
        return;
      }
      node.find(".item").each((__, itemElement) => {
        const item = $(itemElement);
        const date = cleanText(item.find(".date").text()).match(/(\d{1,2})\.(\d{1,2})\./);
        const time = cleanText(item.find(".time").text()).match(/(\d{1,2})[.:](\d{2})/);
        if (!date || !time || !year) return;
        const itemMonth = Number(date[2]);
        if (month !== null && itemMonth !== month) return;
        const startsAt = helsinkiToUtc(
          `${year}-${String(itemMonth).padStart(2, "0")}-${date[1].padStart(2, "0")}`,
          `${time[1].padStart(2, "0")}:${time[2]}`,
        );
        const subtitled =
          subtitles && subtitles.weekdays.length > 0 && subtitles.weekdays.includes(helsinkiWeekday(startsAt));
        performances.push({
          startsAt,
          stage: cleanText(item.find(".terms").first().text()) || undefined,
          ticketUrl: item.find(".tickets a").attr("href") || undefined,
          subtitleLangs: subtitled ? subtitles.langs : undefined,
        });
      });
    });
  return performances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** "Rooleissa <strong>A</strong>, <strong>B</strong> ja <strong>C</strong>": one role, several people. */
function parseCredits($: Page): RawCredit[] {
  const credits: RawCredit[] = [];
  $("#tekijat .content p").each((_, element) => {
    const paragraph = $(element);
    const names = paragraph
      .find("strong")
      .map((__, strong) => cleanText($(strong).text()))
      .get()
      .filter(Boolean);
    const clone = paragraph.clone();
    clone.find("strong").remove();
    // What's left once the names are out: "Rooleissa , , ja" → "Rooleissa".
    const roleText = cleanText(clone.text()).replace(/(?:\s*(?:,|\bja\b|&))+\s*$/, "");
    const roles = mapRoleText(roleText);
    if (/rooleissa|näyttämöllä/i.test(roleText)) {
      for (const name of names) credits.push({ name, roleText, roles: ["CAST"] });
    } else if (roles.length > 0) {
      for (const name of names) credits.push({ name, roleText, roles });
    }
  });
  return credits;
}

function titleCase(text: string): string {
  return text.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}

/** "Selina Keränen, apu: <headline>" + link. We keep critic, outlet and link, not the headline or quote. */
function parseReviews($: Page): RawCriticReview[] {
  const reviews: RawCriticReview[] = [];
  $("#arviot h4").each((_, element) => {
    const heading = cleanText($(element).text());
    const url = $(element).nextAll(".wp-block-buttons").first().find("a").attr("href");
    if (!url) return;
    const byline = heading.split(":")[0];
    const [critic, outlet] = byline.split(",").map((part) => cleanText(part));
    const host = new URL(url).hostname.replace(/^www\./, "");
    reviews.push({
      outlet: outlet ? titleCase(outlet) : host,
      critic: critic ? titleCase(critic) : undefined,
      url,
    });
  });
  return reviews;
}

/**
 * The run in the header, "6.10.–28.11.", has no year: take it from the performance list,
 * stepping back a year if the run starts in a later month than the first listed show.
 */
export function parseRun(text: string, firstPerformance: Date | undefined): { start?: Date; end?: Date } {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.?\s*[–-]\s*(\d{1,2})\.(\d{1,2})\./);
  if (!match || !firstPerformance) return {};
  const [, startDay, startMonth, endDay, endMonth] = match.map(Number);
  const firstYear = firstPerformance.getUTCFullYear();
  const startYear = startMonth > firstPerformance.getUTCMonth() + 1 ? firstYear - 1 : firstYear;
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;
  return {
    start: new Date(Date.UTC(startYear, startMonth - 1, startDay)),
    end: new Date(Date.UTC(endYear, endMonth - 1, endDay)),
  };
}

export function parseDetail(html: string, ref: Pick<RawProduction, "externalId" | "url" | "title">): RawProductionDetail {
  const $ = cheerio.load(html);
  const prose = $(".artist-content-wrapper").text();
  const subtitles = parseSubtitleRule($("#tekstitys .content").text() || prose);
  const performances = parsePerformances($, subtitles);
  const stage = cleanText($(".meta .cats .cat").first().text()) || performances[0]?.stage;
  const run = parseRun(cleanText($(".meta .dates").first().text()), performances[0]?.startsAt);

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: cleanText($("h1.title").first().text()) || ref.title,
    url: ref.url,
    stage,
    durationText: cleanText(prose.match(/kesto on ([^.]+)/i)?.[1] ?? "") || undefined,
    runStart: run.start ?? performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt ?? run.end,
    languages: ["fi"],
    // Every performance only when no weekdays are named.
    subtitleLangs: subtitles && subtitles.weekdays.length === 0 ? subtitles.langs : [],
    credits: parseCredits($),
    performances,
    criticReviews: parseReviews($),
    isVisiting: false,
  });
}

export const ryhmateatteriAdapter: SourceAdapter = {
  id: "ryhmateatteri",
  async fetchProductions() {
    return parseRestList(await politeFetch(listUrl(1)));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
