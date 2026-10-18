import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { buttonPrimary } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { unsubscribeAction } from "@/lib/actions";

/** Reached from the digest email without a session; the signed query is the proof. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function UnsubscribePage({ searchParams }: PageProps<"/[locale]/peru-tilaus">) {
  const [{ locale, t }, query] = await Promise.all([getDictionary(), searchParams]);
  const userId = param(query.u);
  const signature = param(query.s);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="border-b-4 border-double border-ink pb-4 text-display">{t.digest.unsubscribeTitle}</h1>
      {query.done ? (
        <Notice>{t.digest.unsubscribed}</Notice>
      ) : query.error || !userId || !signature ? (
        <Notice tone="error">{t.digest.invalid}</Notice>
      ) : (
        <form action={unsubscribeAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="u" value={userId} />
          <input type="hidden" name="s" value={signature} />
          <p className="text-lg">{t.digest.unsubscribeBody}</p>
          <button type="submit" className={buttonPrimary}>
            {t.digest.unsubscribe}
          </button>
        </form>
      )}
      <p>
        <Link href={href(locale, "asetukset")} className="inline-flex min-h-tap items-center">
          {t.settings.title}
        </Link>
      </p>
    </div>
  );
}
