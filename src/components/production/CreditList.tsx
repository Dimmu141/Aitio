import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { groupCredits, type CreditGroup } from "@/lib/catalogue/credits";
import type { CreditRow } from "@/lib/catalogue/types";
import { Section } from "./Section";

function Rows({ group, locale, t }: { group: CreditGroup; locale: Locale; t: Dictionary }) {
  return group.people.map((person) => (
    <div key={person.slug} className="ai-credit">
      {/* Cast rows name the character; team rows name the role. */}
      <dt>{group.role === "CAST" ? (person.characterName ?? "") : t.roles[group.role]}</dt>
      <dd>
        <Link href={href(locale, "henkilo", person.slug)}>{person.name}</Link>
      </dd>
    </div>
  ));
}

/** The team first, one row per person with the role on the right; the cast under its own label. */
export function CreditList({ credits, locale, t }: { credits: CreditRow[]; locale: Locale; t: Dictionary }) {
  const groups = groupCredits(credits);
  if (groups.length === 0) return null;
  const team = groups.filter((group) => group.role !== "CAST");
  const cast = groups.find((group) => group.role === "CAST");
  return (
    <Section id="credits" title={t.production.credits}>
      {team.length > 0 && (
        <dl>
          {team.map((group) => (
            <Rows key={group.role} group={group} locale={locale} t={t} />
          ))}
        </dl>
      )}
      {cast && (
        <>
          <h3 className="ai-credits__group">{t.roles.CAST}</h3>
          <dl>
            <Rows group={cast} locale={locale} t={t} />
          </dl>
        </>
      )}
    </Section>
  );
}
