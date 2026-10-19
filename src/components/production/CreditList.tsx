import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { groupCredits, teamRows } from "@/lib/catalogue/credits";
import type { CreditRow } from "@/lib/catalogue/types";
import { Section } from "./Section";

function Row({ label, person, locale }: { label: string; person: { slug: string; name: string }; locale: Locale }) {
  return (
    <div className="ai-credit">
      <dt>{label}</dt>
      <dd>
        <Link href={href(locale, "henkilo", person.slug)}>{person.name}</Link>
      </dd>
    </div>
  );
}

/**
 * The team first, one row per person with their roles as the theatre wrote them (when the
 * page is in the theatre's language); the cast under its own label, each with their part.
 */
export function CreditList({
  credits,
  sourceLanguage,
  locale,
  t,
}: {
  credits: CreditRow[];
  sourceLanguage: Locale;
  locale: Locale;
  t: Dictionary;
}) {
  const team = teamRows(credits, (role) => t.roles[role], locale === sourceLanguage);
  const cast = groupCredits(credits).find((group) => group.role === "CAST");
  if (team.length === 0 && !cast) return null;
  return (
    <Section id="credits" title={t.production.credits}>
      {team.length > 0 && (
        <dl>
          {team.map((row) => (
            <Row key={row.person.slug} label={row.roles} person={row.person} locale={locale} />
          ))}
        </dl>
      )}
      {cast && (
        <>
          <h3 className="ai-credits__group">{t.roles.CAST}</h3>
          <dl>
            {cast.people.map((person) => (
              <Row key={person.slug} label={person.characterName ?? ""} person={person} locale={locale} />
            ))}
          </dl>
        </>
      )}
    </Section>
  );
}
