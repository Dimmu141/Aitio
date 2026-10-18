import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/dictionaries";
import { href } from "@/i18n/paths";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { absoluteUrl, SITE_URL } from "@/lib/site";

/** Long enough for someone who checks their email slowly; the token still works only once. */
export const MAGIC_LINK_MINUTES = 20;

/**
 * The email links to our own confirmation page, which has a "Kirjaudu sisään" button,
 * instead of straight to the verify endpoint: mail scanners (Outlook Safe Links and
 * friends) open links in incoming mail and would use up the single-use token.
 */
export function confirmUrl(locale: string, token: string, verifyUrl: string): string {
  const safeLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const next = new URL(verifyUrl).searchParams.get("callbackURL") ?? href(safeLocale, "paivakirja");
  const url = new URL(absoluteUrl(href(safeLocale, "kirjaudu")));
  url.searchParams.set("token", token);
  url.searchParams.set("next", next);
  return url.toString();
}

export const auth = betterAuth({
  appName: "Aitio",
  baseURL: process.env.BETTER_AUTH_URL ?? SITE_URL.origin,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },
  rateLimit: { enabled: true, storage: "database" },
  // Older users shouldn't have to sign in every week.
  session: {
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: { locale: { type: "string", required: false, defaultValue: DEFAULT_LOCALE, input: false } },
  },
  advanced: { cookiePrefix: "aitio" },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_MINUTES * 60,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url, token, metadata }) => {
        const locale = typeof metadata?.locale === "string" && isLocale(metadata.locale) ? metadata.locale : DEFAULT_LOCALE;
        const t = dictionaryFor(locale);
        await sendEmail({
          to: email,
          subject: t.auth.emailSubject,
          text: t.auth.emailBody(confirmUrl(locale, token, url), MAGIC_LINK_MINUTES),
        });
      },
    }),
    nextCookies(),
  ],
});
