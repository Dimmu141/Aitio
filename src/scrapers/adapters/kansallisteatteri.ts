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

const BASE = "https://www.kansallisteatteri.fi";
export const LIST_URL = `${BASE}/ohjelmisto/esitykset-a-o`;

/** "/esitys/viidakon-villit-naiset" → "viidakon-villit-naiset" */
function slugFromPath(path: string): string {
  return path.replace(/^.*\/esitys\//, "").replace(/[/?#].*$/, "");
}

/**
 * Parse the A–Ö list. Productions under the "visiting-repertoire" heading are guest shows.
 */
export function parseList(html: string): RawProduction[] {
  const $ = cheerio.load(html);
  const results = new Map<string, RawProduction>();
  let isVisiting = false;

  $("#repertoire-wrapper")
    .find("h2[id], article.production--teaser")
    .each((_, element) => {
      const node = $(element);
      if (node.is("h2")) {
        isVisiting = node.attr("id") === "visiting-repertoire";
        return;
      }
      const about = node.attr("about");
      if (!about?.startsWith("/esitys/")) return;
      const externalId = slugFromPath(about);
      if (results.has(externalId)) return;
      const candidate = {
        externalId,
        title: cleanText(node.find(".field--name-title").first().text()),
        url: `${BASE}${about}`,
        stageHint: cleanText(node.find(".field--name-field-subtitle").first().text()) || undefined,
        authorHint: cleanText(node.find(".field--name-field-author-information").first().text()) || undefined,
        isVisiting,
      };
      const parsed = rawProductionSchema.safeParse(candidate);
      if (parsed.success) results.set(externalId, parsed.data);
    });

  return [...results.values()];
}

/** "Suomen Kansallisteatteri, Suuri näyttämö" → "Suuri näyttämö" */
function stageFromLocation(location: string): string | undefined {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(", ") : parts[0];
}

function parsePerformances($: cheerio.CheerioAPI): RawPerformance[] {
  const performances = new Map<number, RawPerformance>();
  $(".paragraph--type--performance").each((_, element) => {
    const row = $(element);
    const datetime = row.find(".field--name-field-date time[datetime]").first().attr("datetime");
    const timeText = cleanText(row.find(".field--name-field-time").first().text());
    const timeMatch = /(\d{1,2})[:.](\d{2})/.exec(timeText);
    if (!datetime || !timeMatch) return;
    // The datetime attribute carries the date (at 12:00Z); the wall-clock time is in a separate field.
    const date = datetime.slice(0, 10);
    const startsAt = helsinkiToUtc(date, `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`);
    const location = cleanText(row.find(".field--name-field-location").first().text());
    const ticketHref = row.find(".link-column a[href]").first().attr("href");
    performances.set(startsAt.getTime(), {
      startsAt,
      stage: location ? stageFromLocation(location) : undefined,
      ticketUrl: ticketHref && /^https?:\/\//.test(ticketHref) ? ticketHref : undefined,
    });
  });
  return [...performances.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function parseCredits($: cheerio.CheerioAPI): RawCredit[] {
  const credits: RawCredit[] = [];
  $(".production-team-member").each((_, element) => {
    const member = $(element);
    const roleText = cleanText(member.find(".role-column").text());
    const name = cleanText(member.find(".name-column").text());
    const roles = mapRoleText(roleText);
    if (name && roles.length > 0) credits.push({ name, roleText, roles });
  });
  $(".field--name-field-actors .person-name").each((_, element) => {
    const name = cleanText($(element).text());
    if (name) credits.push({ name, roleText: "Näyttämöllä", roles: ["CAST"] });
  });
  return credits;
}

function parseReviews($: cheerio.CheerioAPI): RawCriticReview[] {
  const reviews: RawCriticReview[] = [];
  $("article.review--teaser").each((_, element) => {
    const article = $(element);
    const url = article.find(".field--name-field-review-link a[href]").first().attr("href");
    const byline = cleanText(article.find(".field--name-field-subtitle").first().text());
    if (!url || !/^https?:\/\//.test(url)) return;
    // Byline format: "Mika Pekkola – Kansan Uutiset"
    const [critic, outlet] = byline.split(/\s+[–—-]\s+/);
    reviews.push({
      url,
      critic: outlet ? critic : undefined,
      outlet: outlet ?? (byline || new URL(url).hostname.replace(/^www\./, "")),
    });
  });
  return reviews;
}

export function parseDetail(html: string, ref: Pick<RawProduction, "externalId" | "url" | "isVisiting">): RawProductionDetail {
  const $ = cheerio.load(html);
  const title = cleanText($("h1 .field--name-title").first().text()) || cleanText($("h1").first().text());
  const performances = parsePerformances($);
  const durationText = cleanText($(".field--name-field-duration-info").first().text()) || undefined;
  const stageFromPerformances = performances.find((performance) => performance.stage)?.stage;

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title,
    url: ref.url,
    stage: stageFromPerformances,
    subtitle: cleanText($(".field--name-field-author-information").first().text()) || undefined,
    durationText,
    runStart: performances[0]?.startsAt,
    runEnd: performances.at(-1)?.startsAt,
    languages: ["fi"],
    subtitleLangs: [],
    credits: parseCredits($),
    performances,
    criticReviews: parseReviews($),
    isVisiting: ref.isVisiting,
  });
}

export const kansallisteatteriAdapter: SourceAdapter = {
  id: "kansallisteatteri",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
