import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { groupCredits } from "@/lib/catalogue/credits";
import type { CreditRow } from "@/lib/catalogue/types";

export function CreditList({ credits, locale, t }: { credits: CreditRow[]; locale: Locale; t: Dictionary }) {
  const groups = groupCredits(credits);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="credits" className="space-y-4">
      <h2 id="credits" className="text-2xl font-semibold">
        {t.production.credits}
      </h2>
      <dl className="space-y-4">
        {groups.map((group) => (
          <div key={group.role}>
            <dt className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-muted">{t.roles[group.role]}</dt>
            <dd>
              <ul className={group.role === "CAST" ? "grid gap-x-6 sm:grid-cols-2" : ""}>
                {group.people.map((person) => (
                  <li key={person.slug} className="py-1">
                    <Link href={href(locale, "henkilo", person.slug)} className="inline-flex min-h-[2.75rem] items-center">
                      {person.name}
                    </Link>
                    {person.characterName && <span className="text-ink-muted"> · {person.characterName}</span>}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
