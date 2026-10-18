import Link from "next/link";
import type { CreditRole } from "@/generated/prisma/enums";
import { t } from "@/i18n/fi";

type Credit = { role: CreditRole; characterName: string | null; person: { slug: string; name: string } };

const CAST_VISIBLE = 8;

type CreditLine = { person: Credit["person"]; label: string };

/** One line per person: "Sävellys, suunnittelu" instead of the same name twice. */
function mergeByPerson(credits: Credit[]): CreditLine[] {
  const lines = new Map<string, CreditLine>();
  for (const credit of credits) {
    const label = credit.role === "CAST" ? (credit.characterName ?? "") : t.role[credit.role];
    const line = lines.get(credit.person.slug);
    if (!line) lines.set(credit.person.slug, { person: credit.person, label });
    else if (label && !line.label.includes(label)) line.label = line.label ? `${line.label}, ${label.toLowerCase()}` : label;
  }
  return [...lines.values()];
}

function CreditRow({ credit }: { credit: CreditLine }) {
  const { label } = credit;
  return (
    <div className="flex justify-between gap-3 border-b border-dotted border-rule-strong py-2.5">
      <dd>
        <Link href={`/henkilo/${credit.person.slug}`} className="font-bold text-ink decoration-rule-strong">
          {credit.person.name}
        </Link>
      </dd>
      <dt className="order-2 text-right text-meta text-ink-muted">{label}</dt>
    </div>
  );
}

function CreditGroup({ credits }: { credits: Credit[] }) {
  return (
    <dl>
      {mergeByPerson(credits).map((credit) => (
        <CreditRow key={credit.person.slug} credit={credit} />
      ))}
    </dl>
  );
}

/** Credits as a programme page; every name links to a person page. */
export function CreditList({ credits }: { credits: Credit[] }) {
  const team = credits.filter((credit) => credit.role !== "CAST");
  const cast = credits.filter((credit) => credit.role === "CAST");
  const visibleCast = cast.slice(0, CAST_VISIBLE);
  const restCast = cast.slice(CAST_VISIBLE);
  return (
    <div>
      {team.length > 0 && <CreditGroup credits={team} />}
      {cast.length > 0 && (
        <>
          <p className="mt-6 mb-1 text-label text-ink-muted uppercase">{t.production.cast}</p>
          <CreditGroup credits={visibleCast} />
          {restCast.length > 0 && (
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer items-center font-bold text-accent marker:content-none group-open:hidden">
                + {restCast.length}
              </summary>
              <CreditGroup credits={restCast} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
