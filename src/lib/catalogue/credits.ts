import type { CreditRole } from "@/generated/prisma/enums";
import type { CreditRow } from "./types";

/** Programme order: the people who made it first, cast last. */
const ROLE_ORDER: CreditRole[] = ["DIRECTOR", "WRITER", "ADAPTATION", "TRANSLATOR", "COMPOSER", "CHOREOGRAPHER", "DESIGNER", "OTHER", "CAST"];

export interface CreditGroup {
  role: CreditRole;
  people: Array<{ slug: string; name: string; characterName: string | null }>;
}

/** Group credits by role in programme order, keeping the theatre's own order inside a role. */
export function groupCredits(credits: CreditRow[]): CreditGroup[] {
  return ROLE_ORDER.flatMap((role) => {
    const seen = new Set<string>();
    const people = credits
      .filter((credit) => credit.role === role)
      .filter((credit) => !seen.has(credit.person.slug) && seen.add(credit.person.slug))
      .map((credit) => ({ ...credit.person, characterName: credit.characterName }));
    return people.length > 0 ? [{ role, people }] : [];
  });
}

/**
 * Poster foot like a programme cover: "Writer · ohjaus Director". When one person
 * wrote and directed, they are named once: "teksti ja ohjaus Kristian Smeds".
 */
export function posterFoot(
  credits: CreditRow[],
  labels: { directedBy: string; writtenAndDirectedBy: string },
): string | null {
  const first = (role: CreditRole) => credits.find((credit) => credit.role === role)?.person;
  const writer = first("WRITER");
  const director = first("DIRECTOR");
  if (writer && director && writer.slug === director.slug) return `${labels.writtenAndDirectedBy} ${director.name}`;
  const parts = [writer?.name, director && `${labels.directedBy} ${director.name}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface TeamRow {
  person: { slug: string; name: string };
  /** "Ohjaus ja dramatisointi", "Lavastussuunnittelu, pukusuunnittelu". */
  roles: string;
}

/** "Lavastussuunnittelu", "Pukusuunnittelu" → "Lavastussuunnittelu, pukusuunnittelu" (acronyms kept). */
function joinLabels(labels: string[]): string {
  return labels
    .map((label, index) => (index > 0 && /^\p{Lu}\p{Ll}/u.test(label) ? label[0].toLocaleLowerCase("fi") + label.slice(1) : label))
    .join(", ");
}

/**
 * The team, one row per person in the theatre's own order. With `sourceText` (the page is
 * in the theatre's language) each role reads as the theatre wrote it; otherwise, or when the
 * theatre gave no label, it is the translated role name.
 */
export function teamRows(credits: CreditRow[], roleName: (role: CreditRole) => string, sourceText: boolean): TeamRow[] {
  const byPerson = new Map<string, { person: TeamRow["person"]; labels: string[] }>();
  for (const credit of credits) {
    if (credit.role === "CAST") continue;
    const row = byPerson.get(credit.person.slug) ?? { person: credit.person, labels: [] };
    const label = (sourceText && credit.roleText) || roleName(credit.role);
    if (!row.labels.some((seen) => seen.toLocaleLowerCase("fi") === label.toLocaleLowerCase("fi"))) row.labels.push(label);
    byPerson.set(credit.person.slug, row);
  }
  return [...byPerson.values()].map(({ person, labels }) => ({ person, roles: joinLabels(labels) }));
}
