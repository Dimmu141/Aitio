import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Notice } from "@/components/Notice";
import { buttonPrimary, input } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { signInAction } from "@/lib/actions";
import { MAGIC_LINK_MINUTES } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/session";

/** Personal and per request: reads the session and the query string. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

type Params = Awaited<PageProps<"/[locale]/kirjaudu">["searchParams"]>;
const param = (params: Params, key: string) => {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
};

export default async function SignInPage({ searchParams }: PageProps<"/[locale]/kirjaudu">) {
  const { locale, t } = await getDictionary();
  const params = await searchParams;
  const next = safeNext(param(params, "next"), href(locale, "paivakirja"));
  const token = param(params, "token");
  const error = param(params, "error");

  if (token) {
    // Step two, from the email: a button rather than an automatic sign-in, so that mail
    // scanners following the link can't use up the token.
    return (
      <div className="max-w-xl space-y-5">
        <h1 className="text-display">{t.auth.confirmTitle}</h1>
        <p>{t.auth.confirmBody}</p>
        <form method="get" action="/api/auth/magic-link/verify">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="callbackURL" value={next} />
          <input type="hidden" name="newUserCallbackURL" value={next} />
          <input type="hidden" name="errorCallbackURL" value={href(locale, "kirjaudu")} />
          <button type="submit" className={`${buttonPrimary} w-full sm:w-auto`}>
            {t.auth.confirm}
          </button>
        </form>
      </div>
    );
  }

  if (await getCurrentUser()) redirect(next);

  if (param(params, "sent")) {
    return (
      <div className="max-w-xl space-y-5">
        <h1 className="text-display">{t.auth.sentTitle}</h1>
        <p className="text-lg">{t.auth.sentBody(MAGIC_LINK_MINUTES)}</p>
        <p>
          <a href={`${href(locale, "kirjaudu")}?next=${encodeURIComponent(next)}`} className="inline-flex min-h-tap items-center">
            {t.auth.sendAgain}
          </a>
        </p>
      </div>
    );
  }

  const message =
    error === "email" ? t.auth.errors.email
    : error === "rate" ? t.auth.errors.rate
    : error === "send" ? t.auth.errors.send
    : error ? t.auth.errors.link
    : null;

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-display">{t.auth.title}</h1>
      {message && <Notice tone="error">{message}</Notice>}
      <p className="text-lg">{t.auth.intro}</p>
      <form action={signInAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-1">
          <span className="font-semibold">{t.auth.email}</span>
          <input type="email" name="email" required autoComplete="email" inputMode="email" className={input} />
        </label>
        <button type="submit" className={`${buttonPrimary} w-full sm:w-auto`}>
          {t.auth.send}
        </button>
      </form>
      <p className="text-base text-ink-muted">
        {t.auth.privacyNote} <a href={href(locale, "tietosuoja")}>{t.auth.privacyLink}</a>
      </p>
    </div>
  );
}
