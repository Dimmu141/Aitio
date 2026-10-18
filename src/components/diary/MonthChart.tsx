import { INTL_LOCALE, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";

export function monthName(month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(2000, month, 1)));
}

/** Twelve bars with the count above each; screen readers get one sentence per month instead. */
export function MonthChart({ months, locale, t }: { months: number[]; locale: Locale; t: Dictionary }) {
  const max = Math.max(1, ...months);
  return (
    <ol className="grid grid-cols-12 items-end gap-1" aria-label={t.year.months}>
      {months.map((count, month) => (
        <li key={month} className="flex flex-col items-center gap-1">
          <span className="sr-only">{t.year.monthBar(monthName(month, locale), count)}</span>
          <span aria-hidden className="text-base tabular-nums">
            {count > 0 ? count : ""}
          </span>
          <span
            aria-hidden
            className={`w-full rounded-t ${count > 0 ? "bg-accent" : "bg-rule"}`}
            style={{ height: `${count > 0 ? Math.max(8, Math.round((count / max) * 96)) : 2}px` }}
          />
          {/* Numbers, not initials: Finnish narrow months repeat (T H M H T K H…). */}
          <span aria-hidden className="text-base text-ink-muted tabular-nums">
            {month + 1}
          </span>
        </li>
      ))}
    </ol>
  );
}
