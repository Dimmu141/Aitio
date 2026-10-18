import Link from "next/link";
import { Stars } from "@/components/Stars";
import type { Locale } from "@/i18n/config";
import { INTL_LOCALE } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import type { DiaryEntryView } from "@/lib/diary/service";

function stubDate(date: Date, locale: Locale) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", ...options }).format(date);
  return { day: format({ day: "numeric" }), month: format({ month: "short" }).replace(".", ""), weekday: format({ weekday: "short" }) };
}

function tagLabel(tag: DiaryEntryView["tags"][number], locale: Locale): string {
  return locale === "sv" ? tag.labelSv : locale === "en" ? tag.labelEn : tag.labelFi;
}

/** A diary entry as a ticket: the show on the ticket, the date on the stub past the perforation. */
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
  const where = [entry.production.theatre, entry.performanceStage ?? entry.production.stage].filter(Boolean).join(" · ");
  return (
    <li id={`entry-${entry.id}`} className={`ai-stub ${highlight ? "border-accent outline-2 outline-accent" : ""}`}>
      <div className="ai-stub__main">
        <h3 className="ai-stub__title">
          <Link href={href(locale, "esitys", entry.production.slug)} className="break-words">
            {entry.production.title}
          </Link>
        </h3>
        <p className="ai-stub__meta">{where}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-meta">
          {entry.rating !== null && (
            <span className="ai-stub__stars">
              <Stars halfStars={entry.rating} label={t.stars(entry.rating)} />
            </span>
          )}
          {entry.isRewatch && <span className="text-ink-muted">↻ {t.diary.rewatch}</span>}
          {entry.review && !entry.isPublic && <span className="text-ink-muted">{t.diary.private}</span>}
        </p>
        {entry.review && <p className="whitespace-pre-line break-words">{entry.review}</p>}
        {entry.hidden && <p className="text-meta font-bold text-accent">{t.diary.hidden}</p>}
        {entry.tags.length > 0 && (
          <ul className="ai-tags pt-1">
            {entry.tags.map((tag) => (
              <li key={tag.slug} className="ai-tag">
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
      <time dateTime={entry.seenOn.toISOString().slice(0, 10)} className="ai-stub__side">
        <span className="ai-stub__month">{date.weekday}</span>
        <span className="ai-stub__day">{date.day}</span>
        <span className="ai-stub__month">{date.month}</span>
      </time>
    </li>
  );
}
