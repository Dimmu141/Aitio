import { cleanText, personName } from "./text";
import type { ProductionTypeName as ProductionType, RawProduction, RawProductionDetail } from "./types";

/**
 * Quiet parser faults: a scrape that "works" but stores half a production (KOM, Oct 2026:
 * no director or cast, "Näyttämöllä Youssef Asad Alkhatib ja" as a role). Pure checks over
 * one parsed production, run by every scrape and printed by --dry-run.
 *
 * Measured on a dry run of all 13 sources (19 Oct 2026, 201 productions); rules that cried
 * wolf were dropped: a premiere long before the first listed show (Kansallisteatteri, HKT
 * and Svenska Teatern drop past dates: 0 of 13 real) and "no performances" (archive pages
 * and announced premieres: 0 of 77 real).
 */
export type SanityRule = "missing-team" | "role-looks-like-names" | "name-not-a-person" | "title-mismatch";

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
  asOf: Date;
}

/** Accepted gaps: sourceId → externalId → rules not to report. Reviewed in code, not clicked away. */
export const KNOWN_GAPS: Record<string, Record<string, SanityRule[]>> = {};

const STAGED_TYPES: ReadonlySet<ProductionType> = new Set(["PLAY", "MUSICAL"]);

type Rule = (ref: RawProduction, detail: RawProductionDetail, context: SanityContext) => string[];

const hasRole = (detail: RawProductionDetail, role: string) =>
  detail.credits.some((credit) => credit.roles.some((candidate) => candidate === role));

/**
 * A running play or musical with no cast (KOM's Poiskatsojat), or with neither director nor
 * designer (Svenska Teatern's Änglagård: 20 actors, nobody else). Devised work without a
 * director (Gob Squad, Viirus' Collage) still credits designers, so it stays quiet.
 */
const missingTeam: Rule = (_ref, detail, { type, asOf }) => {
  const playing = detail.performances.some((performance) => performance.startsAt >= asOf);
  if (!playing || !STAGED_TYPES.has(type)) return [];
  if (!hasRole(detail, "CAST")) return [`Ei näyttelijöitä (${detail.credits.length} muuta tekijää)`];
  if (!hasRole(detail, "DIRECTOR") && !hasRole(detail, "DESIGNER")) {
    return [`Ei ohjaajaa eikä suunnittelijoita, vain ${detail.credits.length} esiintyjää tai muuta`];
  }
  return [];
};

/**
 * "Näyttämöllä Youssef Asad Alkhatib ja" or "Sonja Ahlfors, Joanna Wingren": a name split
 * off at the wrong place. Two capitalised words in a row are a name; a list of role labels
 * ("Regi, Scenografi, Kostym") has a comma between each.
 */
export function roleLooksLikeNames(roleText: string): boolean {
  const text = cleanText(roleText);
  if (/(?:\s(?:ja|och|and|&)|,)$/i.test(text)) return true;
  const words = text.split(" ");
  return words.some(
    (word, index) => index > 0 && /^\p{Lu}\p{Ll}+$/u.test(word) && /^\p{Lu}\p{Ll}+$/u.test(words[index + 1] ?? ""),
  );
}

const suspiciousRoles: Rule = (_ref, detail) =>
  [...new Set(detail.credits.map((credit) => credit.roleText).filter((roleText) => roleText && roleLooksLikeNames(roleText)))].map(
    (roleText) => `Rooli näyttää nimiltä: "${roleText}"`,
  );

/** Two people in one name ("A och B"), a label ("Koncept och manus") or a group ("Arbetsgruppen"). */
const notAPerson: Rule = (_ref, detail) =>
  [...new Set(detail.credits.map((credit) => credit.name).filter((name) => personName(name) !== name))].map(
    (name) => `Ei henkilön nimi: "${name}"`,
  );

/** Soft hyphens, case, punctuation and "&"/"och"/"ja" aside ("Sås och Kopp" = "Sås & Kopp"). */
export function titleKey(title: string): string {
  return cleanText(title.replace(/­/g, ""))
    .toLocaleLowerCase("fi")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(?:och|ja|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The list card names another show than the page it links to (KOM's Lukureivit → NAZA,
 * Svenska Teatern's "Arne Alligator" → "Hej sommaren!"). Lists often shorten titles
 * ("Divan" for "Klockriketeatern: Divan"), so one containing the other is fine.
 */
const titleMismatch: Rule = (ref, detail) => {
  const listed = titleKey(ref.title);
  const page = titleKey(detail.title);
  if (listed.includes(page) || page.includes(listed)) return [];
  return [`Listan otsikko "${ref.title}", sivun "${detail.title}"`];
};

const RULES: Array<[SanityRule, Rule]> = [
  ["missing-team", missingTeam],
  ["role-looks-like-names", suspiciousRoles],
  ["name-not-a-person", notAPerson],
  ["title-mismatch", titleMismatch],
];

export function sanityWarnings(ref: RawProduction, detail: RawProductionDetail, context: SanityContext): SanityWarning[] {
  const accepted = KNOWN_GAPS[context.sourceId]?.[detail.externalId] ?? [];
  return RULES.filter(([rule]) => !accepted.includes(rule)).flatMap(([rule, check]) =>
    check(ref, detail, context).map((text) => ({ rule, externalId: detail.externalId, title: detail.title, detail: text })),
  );
}
