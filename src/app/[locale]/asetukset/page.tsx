import type { Metadata } from "next";
import { Notice } from "@/components/Notice";
import { buttonDanger, buttonPrimary, buttonSecondary, input } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { deleteAccountAction, digestAction, signOutAction, updateNameAction } from "@/lib/actions";
import { MAX_NAME_LENGTH } from "@/lib/diary/service";
import { getDigestOptIn } from "@/lib/engagement/send-digests";
import { isAdmin } from "@/lib/ops/admin";
import { requireUser } from "@/lib/session";

/** Personal and per request. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

export default async function SettingsPage({ searchParams }: PageProps<"/[locale]/asetukset">) {
  const [{ locale, t }, query] = await Promise.all([getDictionary(), searchParams]);
  const user = await requireUser(locale, href(locale, "asetukset"));
  const digest = await getDigestOptIn(user.id);

  return (
    <div className="max-w-xl space-y-10">
      <h1 className="border-b-4 border-double border-ink pb-4 text-display">{t.settings.title}</h1>
      {query.saved === "1" && <Notice>{t.settings.saved}</Notice>}

      <form action={updateNameAction} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <label className="block space-y-1">
          <span className="text-card font-semibold">{t.settings.name}</span>
          <input name="name" defaultValue={user.name} maxLength={MAX_NAME_LENGTH} autoComplete="nickname" className={input} />
          <span className="block text-base text-ink-muted">{t.settings.nameHint}</span>
        </label>
        <button type="submit" className={buttonPrimary}>
          {t.settings.save}
        </button>
      </form>

      <section id="kooste" aria-labelledby="kooste-title" className="scroll-mt-4 space-y-3">
        <h2 id="kooste-title" className="text-card font-semibold">
          {t.digest.settingsTitle}
        </h2>
        {query.saved === "digest" && <Notice>{t.settings.saved}</Notice>}
        <p>{t.digest.settingsBody}</p>
        <form action={digestAction} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex min-h-tap items-center gap-3">
            <input type="checkbox" name="digest" defaultChecked={digest} className="size-6 shrink-0 accent-accent" />
            {t.digest.optIn}
          </label>
          <button type="submit" className={buttonSecondary}>
            {t.digest.save}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-card font-semibold">{t.settings.email}</h2>
        <p className="break-all">{user.email}</p>
        <div className="flex flex-wrap gap-3">
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={buttonSecondary}>
              {t.auth.signOut}
            </button>
          </form>
          <a href="/api/me/export" download className={buttonSecondary}>
            {t.settings.export}
          </a>
        </div>
      </section>

      {isAdmin(user.email) && (
        <p>
          <a href={href("fi", "yllapito")} className="inline-flex min-h-tap items-center font-semibold">
            Ylläpito
          </a>
        </p>
      )}

      <section className="space-y-3 rounded-md border-2 border-ink p-4">
        <h2 className="text-card font-semibold">{t.settings.deleteTitle}</h2>
        {query.error === "confirm" && <Notice tone="error">{t.settings.deleteConfirm}</Notice>}
        <p>{t.settings.deleteBody}</p>
        <form action={deleteAccountAction} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex min-h-tap items-center gap-3">
            <input type="checkbox" name="confirm" required className="size-6 accent-accent" />
            {t.settings.deleteConfirm}
          </label>
          <button type="submit" className={buttonDanger}>
            {t.settings.delete}
          </button>
        </form>
      </section>
    </div>
  );
}
