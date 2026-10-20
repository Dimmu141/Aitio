import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { groupCredits, MINOR_ROWS_SHOWN, teamRows, type TeamRow } from "@/lib/catalogue/credits";
import type { CreditRow } from "@/lib/catalogue/types";
import { Section } from "./Section";

function Row({ label, lang, person, locale }: { label: string; lang?: Locale; person: { slug: string; name: string }; locale: Locale }) {
  return (
    <div className="ai-credit">
      <dt lang={lang}>{label}</dt>
      <dd>
        <Link href={href(locale, "henkilo", person.slug)}>{person.name}</Link>
      </dd>
    </div>
  );
}

/**
 * The team first, one row per person with their roles as the theatre wrote them (marked
 * with the theatre's language when the page is in another); the cast under its own label.
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
  const team = teamRows(credits, (role) => t.roles[role]);
  // The creative team in full; assistants and technicians after a handful, the rest folded.
  const minor = team.filter((row) => row.minor);
  const shown = [...team.filter((row) => !row.minor), ...minor.slice(0, MINOR_ROWS_SHOWN)];
  const folded = minor.slice(MINOR_ROWS_SHOWN);
  const rows = (list: TeamRow[]) =>
    list.map((row) => (
      <Row
        key={row.person.slug}
        label={row.roles}
        lang={row.sourceText && sourceLanguage !== locale ? sourceLanguage : undefined}
        person={row.person}
        locale={locale}
      />
    ));
  const cast = groupCredits(credits).find((group) => group.role === "CAST");
  if (team.length === 0 && !cast) return null;
  return (
    <Section id="credits" title={t.production.credits}>
      {team.length > 0 && <dl>{rows(shown)}</dl>}
      {folded.length > 0 && (
        <details className="group">
          <summary className="flex min-h-tap cursor-pointer list-none items-center font-bold text-accent group-open:hidden [&::-webkit-details-marker]:hidden">
            {t.production.moreCredits(folded.length)}
          </summary>
          <dl>{rows(folded)}</dl>
        </details>
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
