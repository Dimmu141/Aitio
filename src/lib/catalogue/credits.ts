import type { CreditRole } from "@/generated/prisma/enums";
import type { CreditRow } from "./types";

/** Programme order: the people who made it first, cast last. */
const ROLE_ORDER: CreditRole[] = ["DIRECTOR", "WRITER", "TRANSLATOR", "COMPOSER", "CHOREOGRAPHER", "DESIGNER", "OTHER", "CAST"];

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
