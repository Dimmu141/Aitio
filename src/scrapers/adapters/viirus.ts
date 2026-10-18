import * as cheerio from "cheerio";
import { z } from "zod";
import { politeFetch } from "../http";
import { mapRoleText } from "../roles";
import { cleanText, helsinkiToUtc, languageCodes, parseFinnishDate, personName } from "../text";
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
 * Teater Viirus runs a Next.js front end on a headless WordPress (admin.viirus.fi).
 * Every page embeds its WPGraphQL result in `__NEXT_DATA__`, so we read that JSON from
 * the server HTML instead of the rendered markup. We use the Swedish pages only: the
 * Finnish and English ones are translations of the same posts.
 */
export const BASE = "https://www.viirus.fi";
export const LIST_URL = `${BASE}/sv/repertoar/`;

const calendarEntrySchema = z.object({
  startDate: z.string().nullable(),
  startTime: z.string().nullable(),
});

const showsExtrasSchema = z.object({
  showType: z.string().nullable().optional(),
  seasonStart: z.string().nullable().optional(),
  seasonEnd: z.string().nullable().optional(),
  linkToBuyTickets: z.string().nullable().optional(),
  calendar: z.array(calendarEntrySchema).nullable().optional(),
});

const listNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  uri: z.string(),
  showsExtras: showsExtrasSchema.nullable().optional(),
});

const showNodeSchema = z.object({
  __typename: z.literal("Show"),
  databaseId: z.number(),
  title: z.string(),
  content: z.string().nullable(),
  showsExtras: showsExtrasSchema.nullable(),
});

const nextDataSchema = z.object({
  props: z.object({
    pageProps: z.object({
      result: z.object({
        shows: z.object({ nodes: z.array(z.unknown()) }).optional(),
        nodeByUri: z.unknown().optional(),
      }),
    }),
  }),
});

type PageResult = z.infer<typeof nextDataSchema>["props"]["pageProps"]["result"];

function readNextData(html: string): PageResult {
  const raw = cheerio.load(html)("script#__NEXT_DATA__").first().text();
  if (!raw) throw new Error("Viirus page has no __NEXT_DATA__");
  return nextDataSchema.parse(JSON.parse(raw)).props.pageProps.result;
}

/** WPGraphQL global ids are base64 "post:28923"; the number is the WordPress post id. */
function postId(globalId: string): string {
  const decoded = Buffer.from(globalId, "base64").toString("utf8");
  return /^post:(\d+)$/.exec(decoded)?.[1] ?? globalId;
}

/** The Swedish repertoire page: current and upcoming productions, guests marked "guest". */
export function parseList(html: string): RawProduction[] {
  const nodes = readNextData(html).shows?.nodes ?? [];
  const results: RawProduction[] = [];
  for (const node of nodes) {
    const parsed = listNodeSchema.safeParse(node);
    if (!parsed.success || !parsed.data.uri.startsWith("/sv/")) continue;
    results.push(
      rawProductionSchema.parse({
        externalId: postId(parsed.data.id),
        title: cleanText(parsed.data.title),
        url: new URL(parsed.data.uri, BASE).toString(),
        isVisiting: parsed.data.showsExtras?.showType === "guest",
      }),
    );
  }
  return results;
}

/** "2026-10-10T00:00:00+00:00" is a calendar date stored as UTC midnight. */
function datePart(value: string | null | undefined): string | undefined {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "")?.[1];
}

function toUtcDate(value: string | null | undefined): Date | undefined {
  const date = datePart(value);
  return date ? new Date(`${date}T00:00:00.000Z`) : undefined;
}

function parsePerformances(calendar: z.infer<typeof calendarEntrySchema>[]): RawPerformance[] {
  const performances: RawPerformance[] = [];
  for (const entry of calendar) {
    const date = datePart(entry.startDate);
    const time = /^(\d{2}:\d{2})/.exec(entry.startTime ?? "")?.[1];
    if (date && time) performances.push({ startsAt: helsinkiToUtc(date, time) });
  }
  return performances.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** One "<strong>Label</strong> value" line of the production text. */
interface FactLine {
  label: string;
  value: string;
}

/** Split the WordPress content into bold-labelled lines; prose paragraphs have no label. */
export function factLines(content: string): FactLine[] {
  const lines: FactLine[] = [];
  for (const chunk of content.split(/<br\s*\/?>|<\/p>/i)) {
    const match = /^\s*(?:<(?!strong)[^>]+>\s*)*<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i.exec(chunk);
    if (!match) continue;
    const label = cleanText(cheerio.load(`<p>${match[1]}</p>`)("p").text());
    const value = cleanText(cheerio.load(`<p>${match[2]}</p>`)("p").text());
    const [head, ...rest] = label.split(":");
    const joined = cleanText([rest.join(":"), value.replace(/^:\s*/, "")].join(" "));
    lines.push({ label: cleanText(head), value: rest.length > 0 ? joined : value.replace(/^:\s*/, "") });
  }
  return lines;
}

/** "svenska. Finskspråkigt manus finns att tillgå …" → the first sentence names the language. */
function spokenLanguages(lines: FactLine[]): string[] {
  const line = lines.find((item) => /^språk$/i.test(item.label));
  return line ? languageCodes(line.value.split(".")[0]) : [];
}

/** "Textning på svenska och finska" (all in bold) or "Textning svenska, finska, engelska." */
function subtitleLanguages(lines: FactLine[]): string[] {
  const line = lines.find((item) => /^textning\b/i.test(item.label));
  return line ? languageCodes(`${line.label.replace(/^textning/i, "")} ${line.value}`) : [];
}

/** Lines that are facts about the show, or people who are not part of the production. */
const NOT_CREDITS =
  /^(språk|längd|ålder|innehåll|textning|biljett|urpremiär|premiär|nypremiär)|tack|aula|marknadsför|grafisk|konstnärlig ledare|administrativ|press|promo|trailer|fotograf|publikarbet|pedagog|stöds|understöds|finansiär|promotor|programblad|turné|koordinator|kurator|arbetsgrupp|guest|viirus/i;

/** mapRoleText plus the Viirus wordings it doesn't know ("På scenen", "Text"). */
function rolesFor(label: string): CreditRoleName[] {
  const text = label.toLowerCase();
  if (/bygge|tillverk|intimitet|textning/.test(text)) return ["OTHER"];
  if (/översättning|översatt/.test(text)) return ["TRANSLATOR"];
  // Swedish "av" ("by") makes mapRoleText read a writer into "Design av rekvisita".
  const roles = new Set(mapRoleText(label.replace(/\bav\b/gi, " ")));
  if (roles.size === 0) return [];
  if (/på scen|medverkande|skådespel/.test(text)) roles.add("CAST");
  if (/(^|[\s,])text\b/.test(text)) roles.add("WRITER");
  if (roles.size > 1) roles.delete("OTHER");
  return [...roles];
}

/** "Maria Ahlroth, Oskar Pöysti och Lilli Sukula-Lindblom." → three names. */
function namesIn(value: string): string[] {
  return value
    .replace(/\([^)]*\)/g, "")
    .split(/,|\s+och\s+|\s+&\s+/)
    .map((part) => personName(part.replace(/\s*\/.*$/, "").replace(/\.$/, "")))
    .filter((name): name is string => name !== null && /^\p{Lu}/u.test(name));
}

function parseCredits(lines: FactLine[]): RawCredit[] {
  const credits: RawCredit[] = [];
  for (const { label, value } of lines) {
    const basedOn = /^baserad på .+ av (.+)$/i.exec(label);
    if (basedOn) {
      const name = personName(basedOn[1]);
      if (name) credits.push({ name, roleText: "Baserad på", roles: ["WRITER"] });
      continue;
    }
    if (!value || label.length > 60 || NOT_CREDITS.test(label)) continue;
    const roles = rolesFor(label);
    if (roles.length === 0) continue;
    for (const name of namesIn(value)) credits.push({ name, roleText: label, roles });
  }
  return credits;
}

function premiere(lines: FactLine[]): Date | undefined {
  const line = lines.find((item) => /premiär/i.test(item.label) && parseFinnishDate(`${item.label} ${item.value}`));
  return line ? parseFinnishDate(`${line.label} ${line.value}`) : undefined;
}

export function parseDetail(html: string, ref: Pick<RawProduction, "externalId" | "url" | "title" | "isVisiting">): RawProductionDetail {
  const node = showNodeSchema.parse(readNextData(html).nodeByUri);
  const extras = node.showsExtras;
  const lines = factLines(node.content ?? "");
  const performances = parsePerformances(extras?.calendar ?? []);
  const ticketUrl = extras?.linkToBuyTickets ?? undefined;

  return rawProductionDetailSchema.parse({
    externalId: ref.externalId,
    title: cleanText(node.title) || ref.title,
    url: ref.url,
    durationText: lines.find((item) => /^längd$/i.test(item.label))?.value || undefined,
    ticketUrl: ticketUrl && /^https?:\/\//.test(ticketUrl) ? ticketUrl : undefined,
    premiereDate: premiere(lines),
    runStart: toUtcDate(extras?.seasonStart) ?? performances[0]?.startsAt,
    runEnd: toUtcDate(extras?.seasonEnd) ?? performances.at(-1)?.startsAt,
    languages: spokenLanguages(lines),
    subtitleLangs: subtitleLanguages(lines),
    credits: parseCredits(lines),
    performances,
    criticReviews: [],
    isVisiting: extras?.showType === "guest" || ref.isVisiting,
  });
}

export const viirusAdapter: SourceAdapter = {
  id: "viirus",
  async fetchProductions() {
    return parseList(await politeFetch(LIST_URL));
  },
  async fetchProductionDetail(ref) {
    return parseDetail(await politeFetch(ref.url), ref);
  },
};
