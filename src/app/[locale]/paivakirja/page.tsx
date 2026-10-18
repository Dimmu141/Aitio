import type { Metadata } from "next";
import Link from "next/link";
import { TicketStub } from "@/components/diary/TicketStub";
import { Notice } from "@/components/Notice";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { type DiaryEntryView, getDiary } from "@/lib/diary/service";
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
  const entries = await getDiary(user.id);
  const saved = typeof query.saved === "string" ? query.saved : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-double border-ink pb-4">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">{t.diary.title}</h1>
          {user.name && <p className="text-lg text-ink-muted">{user.name}</p>}
        </div>
        <Link href={href(locale, "asetukset")} className="inline-flex min-h-tap items-center">
          {t.diary.settings}
        </Link>
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
            <h2 id={`year-${year}`} className="text-2xl font-semibold">
              {t.diary.year(year, items.length)}
            </h2>
            <ul className="space-y-3">
              {items.map((entry) => (
                <TicketStub key={entry.id} entry={entry} highlight={entry.id === saved} locale={locale} t={t} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
