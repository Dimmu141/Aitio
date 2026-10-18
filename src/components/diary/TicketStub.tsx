import Link from "next/link";
import { Stars } from "@/components/Stars";
import type { Locale } from "@/i18n/config";
import { INTL_LOCALE } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import type { DiaryEntryView } from "@/lib/diary/service";
import { posterTone } from "@/lib/poster";

function stubDate(date: Date, locale: Locale) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", ...options }).format(date);
  return { day: format({ day: "numeric" }), month: format({ month: "short" }).replace(".", ""), weekday: format({ weekday: "short" }) };
}

function tagLabel(tag: DiaryEntryView["tags"][number], locale: Locale): string {
  return locale === "sv" ? tag.labelSv : locale === "en" ? tag.labelEn : tag.labelFi;
}

/** A diary entry as a torn ticket: date on the stub, the show on the ticket. */
export function TicketStub({
  entry,
  highlight,
  locale,
  t,
}: {
  entry: DiaryEntryView;
  highlight: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const date = stubDate(entry.seenOn, locale);
  const tone = posterTone(entry.production.slug);
  const where = [entry.production.theatre, entry.performanceStage ?? entry.production.stage].filter(Boolean).join(" · ");
  return (
    <li
      id={`entry-${entry.id}`}
      className={`flex overflow-hidden rounded-md border bg-white ${highlight ? "border-accent ring-2 ring-accent" : "border-rule"}`}
    >
      <div
        className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-paper/60 px-2 py-3 text-center"
        style={{ backgroundColor: tone.background, color: tone.text }}
      >
        <span className="text-sm uppercase tracking-wider">{date.weekday}</span>
        <span className="font-serif text-4xl font-semibold leading-none">{date.day}</span>
        <span className="text-sm uppercase tracking-wider">{date.month}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1 px-4 py-3">
        <h3 className="text-xl font-semibold">
          <Link href={href(locale, "esitys", entry.production.slug)} className="break-words">
            {entry.production.title}
          </Link>
        </h3>
        <p className="text-base text-ink-muted">{where}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-base">
          {entry.rating !== null && <Stars halfStars={entry.rating} label={t.stars(entry.rating)} />}
          {entry.isRewatch && <span className="text-ink-muted">↻ {t.diary.rewatch}</span>}
          {entry.review && !entry.isPublic && <span className="text-ink-muted">{t.diary.private}</span>}
        </p>
        {entry.review && <p className="whitespace-pre-line break-words">{entry.review}</p>}
        {entry.hidden && <p className="text-base font-semibold text-accent">{t.diary.hidden}</p>}
        {entry.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {entry.tags.map((tag) => (
              <li key={tag.slug} className="rounded-full border border-rule px-2.5 text-base">
                {tagLabel(tag, locale)}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link
            href={`${href(locale, "merkitse", entry.production.slug)}?entry=${entry.id}`}
            className="inline-flex min-h-tap items-center"
          >
            {t.diary.edit}
          </Link>
        </p>
      </div>
    </li>
  );
}
