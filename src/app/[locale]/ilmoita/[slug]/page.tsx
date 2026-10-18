import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { buttonPrimary, chip } from "@/components/ui";
import { ReportReason } from "@/generated/prisma/enums";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { reportAction } from "@/lib/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Personal and per request. The slug is the diary entry id. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

export default async function ReportPage({ params, searchParams }: PageProps<"/[locale]/ilmoita/[slug]">) {
  const [{ slug: entryId }, query, { locale, t }] = await Promise.all([params, searchParams, getDictionary()]);
  const user = await requireUser(locale, href(locale, "ilmoita", entryId));
  const entry = await db.diaryEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, review: true, isPublic: true, production: { select: { slug: true, title: true } } },
  });
  if (!entry?.review || !entry.isPublic) notFound();

  const back = (
    <Link href={href(locale, "esitys", entry.production.slug)} className="inline-flex min-h-tap items-center">
      {entry.production.title}
    </Link>
  );
  if (query.done) {
    return (
      <div className="max-w-xl space-y-4">
        <Notice>{query.done === "own" ? t.report.own : t.report.thanks}</Notice>
        <p>{back}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-display">{t.report.title}</h1>
      <p>{back}</p>
      <blockquote className="whitespace-pre-line break-words border-l-4 border-rule pl-4 text-ink-muted">{entry.review}</blockquote>
      {query.error === "rate" && <Notice tone="error">{t.report.rate}</Notice>}
      {entry.userId === user.id ? (
        <Notice>{t.report.own}</Notice>
      ) : (
        <form action={reportAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entryId" value={entryId} />
          <fieldset>
            <legend className="mb-2 text-card font-semibold">{t.report.reason}</legend>
            <div className="flex flex-col items-start gap-2">
              {Object.values(ReportReason).map((reason) => (
                <label key={reason} className={chip}>
                  <input type="radio" name="reason" value={reason} required className="sr-only" />
                  {t.report.reasons[reason]}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className={buttonPrimary}>
            {t.report.send}
          </button>
        </form>
      )}
    </div>
  );
}
