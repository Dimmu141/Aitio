import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import type { Badge } from "@/lib/engagement/badges";
import { formatCalendarDate } from "@/lib/format";

function Stamp({ badge, locale, t }: { badge: Badge; locale: Locale; t: Dictionary }) {
  const text = t.badges.items[badge.id];
  const earned = badge.earnedOn !== null;
  return (
    <li
      className={`rounded-md p-3 ${earned ? "border-[6px] border-double border-ink bg-paper-raised" : "border-2 border-dashed border-rule"}`}
    >
      <p className="font-serif text-card font-semibold">{text.name}</p>
      <p className="text-base">{text.description}</p>
      <p className="text-base text-ink-muted">
        {badge.earnedOn
          ? t.badges.earnedOn(formatCalendarDate(new Date(`${badge.earnedOn}T00:00:00Z`), locale))
          : badge.progress && t.badges.progress(badge.progress.current, badge.progress.target)}
      </p>
    </li>
  );
}

/** Earned badges as programme-style stamps; the rest behind a <details> so the page stays short. */
export function BadgeList({ badges, locale, t }: { badges: Badge[]; locale: Locale; t: Dictionary }) {
  const earned = badges.filter((badge) => badge.earnedOn !== null);
  const locked = badges.filter((badge) => badge.earnedOn === null);
  return (
    <section aria-labelledby="badges" className="space-y-3">
      <h2 id="badges" className="text-section">
        {t.badges.title} <span className="text-lg font-normal text-ink-muted">{t.badges.earned(earned.length, badges.length)}</span>
      </h2>
      {earned.length === 0 ? (
        <p>{t.badges.none}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {earned.map((badge) => (
            <Stamp key={badge.id} badge={badge} locale={locale} t={t} />
          ))}
        </ul>
      )}
      {locked.length > 0 && (
        <details>
          <summary className="inline-flex min-h-tap cursor-pointer items-center">{t.badges.locked(locked.length)}</summary>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {locked.map((badge) => (
              <Stamp key={badge.id} badge={badge} locale={locale} t={t} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
