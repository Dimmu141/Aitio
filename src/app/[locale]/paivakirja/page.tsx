import type { Metadata } from "next";
import Link from "next/link";
import { BadgeList } from "@/components/diary/BadgeList";
import { TicketStub } from "@/components/diary/TicketStub";
import { Notice } from "@/components/Notice";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { type DiaryEntryView, getDiary } from "@/lib/diary/service";
import { badges } from "@/lib/engagement/badges";
import { getEntryFacts, theatreCount } from "@/lib/engagement/facts";
import { helsinkiDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

/** Personal and per request. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

function byYear(entries: DiaryEntryView[]): Array<[number, DiaryEntryView[]]> {
  const groups = new Map<number, DiaryEntryView[]>();
  for (const entry of entries) {
    const year = entry.seenOn.getUTCFullYear();
    groups.set(year, [...(groups.get(year) ?? []), entry]);
  }
  return [...groups.entries()];
}

export default async function DiaryPage({ searchParams }: PageProps<"/[locale]/paivakirja">) {
  const [{ locale, t }, query] = await Promise.all([getDictionary(), searchParams]);
  const user = await requireUser(locale, href(locale, "paivakirja"));
  const [entries, facts, theatres] = await Promise.all([getDiary(user.id), getEntryFacts(user.id), theatreCount()]);
  const earned = badges(facts, theatres, helsinkiDate(new Date()));
  const saved = typeof query.saved === "string" ? query.saved : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-double border-ink pb-4">
        <div>
          <h1 className="text-display">{t.diary.title}</h1>
          {user.name && <p className="text-lg text-ink-muted">{user.name}</p>}
        </div>
        <nav className="flex flex-wrap gap-x-6">
          {entries.length > 0 && (
            <a href="#badges" className="inline-flex min-h-tap items-center">
              {t.badges.title}
            </a>
          )}
          <Link href={href(locale, "asetukset")} className="inline-flex min-h-tap items-center">
            {t.diary.settings}
          </Link>
        </nav>
      </header>

      {saved && <Notice>{t.diary.saved}</Notice>}
      {query.deleted && <Notice>{t.diary.deleted}</Notice>}

      {entries.length === 0 ? (
        <p className="text-lg">
          {t.diary.empty} <Link href={href(locale)}>{t.home.title}</Link>
        </p>
      ) : (
        byYear(entries).map(([year, items]) => (
          <section key={year} aria-labelledby={`year-${year}`} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 id={`year-${year}`} className="text-section">
                {t.diary.year(year, items.length)}
              </h2>
              <Link href={href(locale, "paivakirja", String(year))} className="inline-flex min-h-tap items-center">
                {t.year.link(year)}
              </Link>
            </div>
            <ul className="space-y-4">
              {items.map((entry) => (
                <TicketStub key={entry.id} entry={entry} highlight={entry.id === saved} locale={locale} t={t} />
              ))}
            </ul>
          </section>
        ))
      )}

      {entries.length > 0 && <BadgeList badges={earned} locale={locale} t={t} />}
    </div>
  );
}
