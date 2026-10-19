import { cleanText, personName } from "./text";
import type { ProductionTypeName as ProductionType, RawProduction, RawProductionDetail } from "./types";

/**
 * Quiet parser faults: a scrape that "works" but stores half a production (KOM, Oct 2026:
 * 19 of 49 dates, no director, "Näyttämöllä Youssef Asad Alkhatib ja" as a role). Pure
 * checks over one parsed production, run by every scrape and printed by --dry-run.
 */
export type SanityRule =
  | "premiere-before-run"
  | "no-director"
  | "role-looks-like-names"
  | "name-not-a-person"
  | "no-performances"
  | "title-mismatch";

export interface SanityWarning {
  rule: SanityRule;
  externalId: string;
  title: string;
  /** Finnish, shown as is to the admin. */
  detail: string;
}

export interface SanityContext {
  sourceId: string;
  type: ProductionType;
  /** The source lists every performance, past ones included (not Espoo's next few). */
  fullSchedule: boolean;
  asOf: Date;
}

/** Accepted gaps: sourceId → externalId → rules not to report. Reviewed in code, not clicked away. */
export const KNOWN_GAPS: Record<string, Record<string, SanityRule[]>> = {};

const DAY_MS = 86_400_000;
/** A premiere this much before the first stored show means the page's early dates were lost. */
export const PREMIERE_SLACK_DAYS = 7;
/** Older premieres are often before the page's own listing starts (long runs, revivals). */
export const PREMIERE_RECENT_DAYS = 120;
const DIRECTED_TYPES: ReadonlySet<ProductionType> = new Set(["PLAY", "MUSICAL"]);

type Rule = (ref: RawProduction, detail: RawProductionDetail, context: SanityContext) => string[];

const fmtDate = (date: Date) => `${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;

const premiereBeforeRun: Rule = (_ref, detail, { fullSchedule, asOf }) => {
  const premiere = detail.premiereDate;
  const first = detail.performances.reduce<Date | null>(
    (earliest, performance) => (!earliest || performance.startsAt < earliest ? performance.startsAt : earliest),
    null,
  );
  if (!premiere || !first || !fullSchedule || detail.performancesPartial) return [];
  if (asOf.getTime() - premiere.getTime() > PREMIERE_RECENT_DAYS * DAY_MS) return [];
  if (first.getTime() - premiere.getTime() <= PREMIERE_SLACK_DAYS * DAY_MS) return [];
  return [`Ensi-ilta ${fmtDate(premiere)}, ensimmäinen esitys ${fmtDate(first)}`];
};

const noDirector: Rule = (_ref, detail, { type, asOf }) => {
  const playing = detail.performances.some((performance) => performance.startsAt >= asOf);
  if (!playing || !DIRECTED_TYPES.has(type)) return [];
  if (detail.credits.some((credit) => credit.roles.includes("DIRECTOR"))) return [];
  return [`Ei ohjaajaa, vaikka tyyppi on ${type} (${detail.credits.length} muuta tekijää)`];
};

/** "Näyttämöllä Youssef Asad Alkhatib ja": a name split off at the wrong place. */
export function roleLooksLikeNames(roleText: string): boolean {
  const text = cleanText(roleText);
  if (/(?:\s(?:ja|och|and|&)|,)$/i.test(text)) return true;
  const capitalised = text.split(" ").slice(1).filter((word) => /^\p{Lu}\p{Ll}/u.test(word));
  return capitalised.length >= 2;
}

const suspiciousRoles: Rule = (_ref, detail) =>
  [...new Set(detail.credits.map((credit) => credit.roleText).filter((roleText) => roleText && roleLooksLikeNames(roleText)))].map(
    (roleText) => `Rooli näyttää nimiltä: "${roleText}"`,
  );

const notAPerson: Rule = (_ref, detail) =>
  [...new Set(detail.credits.map((credit) => credit.name).filter((name) => personName(name) !== name))].map(
    (name) => `Ei henkilön nimi: "${name}"`,
  );

const noPerformances: Rule = (_ref, detail) => (detail.performances.length === 0 ? ["Ei yhtään esitystä"] : []);

/** Soft hyphens, case and punctuation aside. */
export function titleKey(title: string): string {
  return cleanText(title.replace(/­/g, ""))
    .toLocaleLowerCase("fi")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const titleMismatch: Rule = (ref, detail) =>
  titleKey(ref.title) === titleKey(detail.title) ? [] : [`Listan otsikko "${ref.title}", sivun "${detail.title}"`];

const RULES: Array<[SanityRule, Rule]> = [
  ["premiere-before-run", premiereBeforeRun],
  ["no-director", noDirector],
  ["role-looks-like-names", suspiciousRoles],
  ["name-not-a-person", notAPerson],
  ["no-performances", noPerformances],
  ["title-mismatch", titleMismatch],
];

export function sanityWarnings(ref: RawProduction, detail: RawProductionDetail, context: SanityContext): SanityWarning[] {
  const accepted = KNOWN_GAPS[context.sourceId]?.[detail.externalId] ?? [];
  return RULES.filter(([rule]) => !accepted.includes(rule)).flatMap(([rule, check]) =>
    check(ref, detail, context).map((text) => ({ rule, externalId: detail.externalId, title: detail.title, detail: text })),
  );
}
