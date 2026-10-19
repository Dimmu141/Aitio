import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Notice } from "@/components/Notice";
import { buttonDanger, buttonPrimary, chip, input } from "@/components/ui";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { deleteEntryAction, saveEntryAction } from "@/lib/actions";
import { DRAFT_COOKIE, openDraft } from "@/lib/diary/draft";
import { defaultWhen, MAX_REVIEW_LENGTH } from "@/lib/diary/entry-form";
import { type EditableEntry, getLogContext, getOwnEntry, type LogContext } from "@/lib/diary/service";
import { MAX_TAGS_PER_ENTRY } from "@/lib/diary/tags";
import { formatCalendarDate, formatPerformance, helsinkiDate } from "@/lib/format";
import { getCurrentUser, requireUser } from "@/lib/session";

/** Personal and per request. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

const HALF_STARS = Array.from({ length: 10 }, (_, index) => index + 1);
const ERROR_CODES = ["date", "rating", "review", "tags", "performance", "rate"] as const;

function ratingLabel(halfStars: number, locale: Locale): string {
  const value = halfStars / 2;
  return locale === "en" ? String(value) : value.toLocaleString(locale === "sv" ? "sv-FI" : "fi-FI");
}

function tagLabel(tag: LogContext["tags"][number], locale: Locale): string {
  return locale === "sv" ? tag.labelSv : locale === "en" ? tag.labelEn : tag.labelFi;
}

function Errors({ codes, t }: { codes: string[]; t: Dictionary }) {
  const known = ERROR_CODES.filter((code) => codes.includes(code));
  if (known.length === 0) return null;
  return (
    <Notice tone="error">
      {known.map((code) => (
        <span key={code} className="block">
          {t.log.errors[code]}
        </span>
      ))}
    </Notice>
  );
}

function WhenField({
  context,
  entry,
  asOf,
  locale,
  t,
}: {
  context: LogContext;
  entry: EditableEntry | null;
  asOf: Date;
  locale: Locale;
  t: Dictionary;
}) {
  const known = entry?.performanceId && context.performances.some((p) => p.id === entry.performanceId);
  const selected = entry ? (known ? `perf:${entry.performanceId}` : "date") : defaultWhen(context.performances, asOf);
  const today = helsinkiDate(asOf);
  const dateValue = entry && !known ? entry.seenOn.toISOString().slice(0, 10) : today;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-card font-semibold">{t.log.when}</legend>
      <div className="flex flex-wrap gap-2">
        {context.performances.map((performance) => (
          <label key={performance.id} className={chip}>
            <input
              type="radio"
              name="when"
              value={`perf:${performance.id}`}
              defaultChecked={selected === `perf:${performance.id}`}
              className="sr-only"
            />
            {formatPerformance(performance.startsAt, locale, asOf)}
          </label>
        ))}
        <label className={chip}>
          <input type="radio" name="when" value="date" defaultChecked={selected === "date"} className="sr-only" />
          {t.log.otherDate}
        </label>
      </div>
      <label className="block max-w-xs space-y-1 pt-1">
        <span className="text-base text-ink-muted">{t.log.date}</span>
        <input type="date" name="date" defaultValue={dateValue} max={today} min="1950-01-01" className={input} />
      </label>
    </fieldset>
  );
}

function RatingField({ entry, locale, t }: { entry: EditableEntry | null; locale: Locale; t: Dictionary }) {
  const current = entry?.rating ?? null;
  return (
    <fieldset>
      <legend className="mb-2 text-card font-semibold">
        {t.log.rating} <span className="text-base font-normal text-ink-muted">({t.log.optional})</span>
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {HALF_STARS.map((halfStars) => (
          <label key={halfStars} className={`${chip} justify-center whitespace-nowrap px-0`}>
            <input
              type="radio"
              name="rating"
              value={halfStars}
              defaultChecked={current === halfStars}
              className="sr-only"
              aria-label={t.stars(halfStars)}
            />
            <span aria-hidden="true">
              {ratingLabel(halfStars, locale)}
              <span> ★</span>
            </span>
          </label>
        ))}
      </div>
      <label className={`${chip} mt-2`}>
        <input type="radio" name="rating" value="" defaultChecked={current === null} className="sr-only" />
        {t.log.noRating}
      </label>
    </fieldset>
  );
}

function MoreFields({
  context,
  entry,
  locale,
  t,
}: {
  context: LogContext;
  entry: EditableEntry | null;
  locale: Locale;
  t: Dictionary;
}) {
  const open = Boolean(entry?.review || entry?.tagSlugs.length);
  const isPublic = entry ? entry.isPublic : true;
  const isRewatch = entry ? entry.isRewatch : context.earlier.length > 0;
  return (
    <details open={open} className="group rounded-md border border-rule bg-paper-raised p-4">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        {t.log.more}
        <span aria-hidden="true" className="text-2xl group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3 space-y-6">
        <label className="block space-y-1">
          <span className="font-semibold">{t.log.review}</span>
          <textarea
            name="review"
            rows={5}
            maxLength={MAX_REVIEW_LENGTH}
            defaultValue={entry?.review ?? ""}
            className={`${input} py-2`}
          />
          <span className="text-base text-ink-muted">{t.log.reviewHint(MAX_REVIEW_LENGTH)}</span>
        </label>
        <label className="flex min-h-tap items-start gap-3">
          <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="mt-1 size-6 accent-accent" />
          <span>
            {t.log.isPublic}
            <span className="block text-base text-ink-muted">
              {t.log.publicAs(context.userName || t.reviews.anonymous)}
            </span>
          </span>
        </label>
        <fieldset>
          <legend className="font-semibold">{t.log.tags}</legend>
          <p className="mb-2 text-base text-ink-muted">{t.log.tagsHint(MAX_TAGS_PER_ENTRY)}</p>
          <div className="flex flex-wrap gap-2">
            {context.tags.map((tag) => (
              <label key={tag.slug} className={chip}>
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.slug}
                  defaultChecked={entry?.tagSlugs.includes(tag.slug)}
                  className="sr-only"
                />
                {tagLabel(tag, locale)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-tap items-center gap-3">
          <input type="checkbox" name="isRewatch" defaultChecked={isRewatch} className="size-6 accent-accent" />
          {t.log.rewatch}
        </label>
      </div>
    </details>
  );
}

export default async function LogPage({ params, searchParams }: PageProps<"/[locale]/merkitse/[slug]">) {
  const [{ slug }, query, { locale, t }] = await Promise.all([params, searchParams, getDictionary()]);
  const entryParam = typeof query.entry === "string" ? query.entry : null;
  const self = `${href(locale, "merkitse", slug)}${entryParam ? `?entry=${encodeURIComponent(entryParam)}` : ""}`;
  // A new entry can be filled in signed out; it waits as a draft while the visitor signs in.
  const user = entryParam ? await requireUser(locale, self) : await getCurrentUser();

  // Request time only: signed out this page is reachable by prefetch, which may not take the time.
  await connection();
  const asOf = new Date();
  const context = await getLogContext(user?.id ?? null, slug, asOf);
  if (!context) notFound();
  const entry = user && entryParam ? await getOwnEntry(user.id, context.production.id, entryParam) : null;
  const draft = entry ? null : openDraft((await cookies()).get(DRAFT_COOKIE)?.value, slug, process.env.BETTER_AUTH_SECRET ?? "");
  const values = entry ?? (draft && { ...draft, id: "", seenOn: new Date(`${draft.seenOn}T12:00:00Z`) });
  // Before the premiere only an existing entry can be edited (e.g. one logged before the dates were known).
  if (!context.started && !entry) redirect(href(locale, "esitys", slug));
  const errors = typeof query.error === "string" ? query.error.split(",") : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-label font-bold uppercase tracking-[0.06em] text-ink-muted">
          {[context.production.theatre, context.production.stage].filter(Boolean).join(" · ")}
        </p>
        <h1 className="text-display">
          <Link href={href(locale, "esitys", slug)}>{context.production.title}</Link>
        </h1>
        <p className="mt-1 text-xl">{entry ? t.log.editTitle : t.log.title}</p>
      </header>

      {!entry && context.earlier.length > 0 && (
        <p className="text-base">
          {t.log.earlier}:{" "}
          {context.earlier.map((earlier, index) => (
            <span key={earlier.id}>
              {index > 0 && ", "}
              <Link href={`${href(locale, "merkitse", slug)}?entry=${earlier.id}`}>
                {formatCalendarDate(earlier.seenOn, locale)}
              </Link>
            </span>
          ))}
        </p>
      )}

      <Errors codes={errors} t={t} />
      {!user && <Notice>{t.log.signedOutNote}</Notice>}
      {user && draft && <Notice>{t.log.draftReady}</Notice>}

      <form action={saveEntryAction} className="space-y-8">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={slug} />
        {entry && <input type="hidden" name="entryId" value={entry.id} />}
        <WhenField context={context} entry={values} asOf={asOf} locale={locale} t={t} />
        <RatingField entry={values} locale={locale} t={t} />
        <MoreFields context={context} entry={values} locale={locale} t={t} />
        {/* Sticky so the second tap is always within reach on a phone. */}
        <div className="sticky bottom-0 -mx-4 border-t border-rule bg-paper/95 px-4 py-3">
          <button type="submit" className={`${buttonPrimary} w-full`}>
            {t.log.save}
          </button>
        </div>
      </form>

      {entry && (
        <form action={deleteEntryAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entryId" value={entry.id} />
          <button type="submit" className={buttonDanger}>
            {t.log.delete}
          </button>
        </form>
      )}
    </div>
  );
}
