import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/dictionaries";
import { href } from "@/i18n/paths";
import { AUTH_COOKIE_PREFIX, CLIENT_IP_HEADERS, SESSION_DAYS, SIGN_IN_ATTEMPTS, SIGN_IN_MINUTES } from "@/lib/auth-config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { safeNext } from "@/lib/safe-next";
import { sealSignIn } from "@/lib/sign-in-token";
import { absoluteUrl, SITE_URL } from "@/lib/site";

export { SIGN_IN_MINUTES };

/** Set by signInAction for the email callback, which only sees the request headers. */
export const LOCALE_HEADER = "x-aitio-locale";
export const NEXT_HEADER = "x-aitio-next";

/**
 * The email links to our own confirmation page, which has a "Kirjaudu sisään" button,
 * instead of signing in on GET: mail scanners (Outlook Safe Links and friends) open
 * links in incoming mail and would use up the single-use code.
 */
export function confirmUrl(locale: string, token: string, next: string): string {
  const safeLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const url = new URL(absoluteUrl(href(safeLocale, "kirjaudu")));
  url.searchParams.set("token", token);
  url.searchParams.set("next", safeNext(next, href(safeLocale, "paivakirja")));
  return url.toString();
}

const secret = process.env.BETTER_AUTH_SECRET ?? "";

export const auth = betterAuth({
  appName: "Aitio",
  baseURL: process.env.BETTER_AUTH_URL ?? SITE_URL.origin,
  secret,
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },
  rateLimit: { enabled: true, storage: "database" },
  session: {
    expiresIn: 60 * 60 * 24 * SESSION_DAYS,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: { locale: { type: "string", required: false, defaultValue: DEFAULT_LOCALE, input: false } },
  },
  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    // Without a trusted client IP, Better Auth rate limits everyone in one shared bucket.
    ipAddress: { ipAddressHeaders: CLIENT_IP_HEADERS },
  },
  plugins: [
    // One emailed code, two ways to use it: tap the link (it carries the code, sealed) or
    // type the six digits, e.g. when the mail app opens links in a browser of its own.
    emailOTP({
      otpLength: 6,
      expiresIn: SIGN_IN_MINUTES * 60,
      allowedAttempts: SIGN_IN_ATTEMPTS,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        if (type !== "sign-in") return;
        const requested = ctx?.headers?.get(LOCALE_HEADER) ?? "";
        const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
        const t = dictionaryFor(locale);
        const link = confirmUrl(locale, sealSignIn({ email, otp }, secret), ctx?.headers?.get(NEXT_HEADER) ?? "");
        await sendEmail({ to: email, subject: t.auth.emailSubject(otp), text: t.auth.emailBody(link, otp, SIGN_IN_MINUTES) });
      },
    }),
    nextCookies(),
  ],
});
