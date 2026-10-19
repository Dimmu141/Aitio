"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { auth, LOCALE_HEADER, NEXT_HEADER } from "@/lib/auth";
import { CLIENT_IP_HEADERS, SIGN_IN_EMAIL_COOKIE, SIGN_IN_MINUTES } from "@/lib/auth-config";
import { openSignIn } from "@/lib/sign-in-token";
import { DRAFT_COOKIE, DRAFT_MINUTES, sealDraft } from "@/lib/diary/draft";
import { productionTag } from "@/lib/catalogue/tags";
import { formFields, parseEntryForm } from "@/lib/diary/entry-form";
import * as diary from "@/lib/diary/service";
import { setDigest, unsubscribe } from "@/lib/engagement/send-digests";
import { consume, LIMITS } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { addToWatchlist, removeFromWatchlist } from "@/lib/diary/watchlist";
import { getCurrentUser, requireUser, signInHref } from "@/lib/session";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localeOf(formData: FormData): Locale {
  const value = text(formData, "locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The client IP from the trusted proxy headers, or null locally (where there is no proxy). */
async function clientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  for (const name of CLIENT_IP_HEADERS) {
    const value = requestHeaders.get(name)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return null;
}

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

export async function signInAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const signIn = href(locale, "kirjaudu");
  const next = safeNext(text(formData, "next"), href(locale, "paivakirja"));
  const email = z.email().safeParse(text(formData, "email").toLowerCase());
  if (!email.success) redirect(withQuery(signIn, { error: "email", next }));

  // Without a forwarded IP (local runs) every request would share one bucket, so only the
  // per-email limit applies there.
  const ip = await clientIp();
  const allowed =
    (await consume(`signin:email:${email.data}`, LIMITS.signInPerEmail)) &&
    (ip === null || (await consume(`signin:ip:${ip}`, LIMITS.signInPerIp)));
  if (!allowed) redirect(withQuery(signIn, { error: "rate", next }));

  // The email callback only sees headers: tell it the language and where to return.
  const forwarded = new Headers(await headers());
  forwarded.set(LOCALE_HEADER, locale);
  forwarded.set(NEXT_HEADER, next);
  try {
    await auth.api.sendVerificationOTP({ body: { email: email.data, type: "sign-in" }, headers: forwarded });
  } catch (error) {
    console.error("Sending the sign-in code failed", error);
    redirect(withQuery(signIn, { error: "send", next }));
  }
  (await cookies()).set(SIGN_IN_EMAIL_COOKIE, email.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGN_IN_MINUTES * 60,
  });
  redirect(withQuery(signIn, { sent: "1", next }));
}

/**
 * Sign in with the emailed code: typed on the "check your email" page (the address comes
 * from the cookie set when it was sent), or carried, sealed, by the link in the email.
 */
export async function verifyCodeAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const signIn = href(locale, "kirjaudu");
  const next = safeNext(text(formData, "next"), href(locale, "paivakirja"));
  const fromLink = text(formData, "token");
  const jar = await cookies();
  const claim = fromLink
    ? openSignIn(fromLink, process.env.BETTER_AUTH_SECRET ?? "")
    : { email: jar.get(SIGN_IN_EMAIL_COOKIE)?.value ?? "", otp: text(formData, "code").replace(/\D/g, "") };
  const retry = fromLink ? withQuery(signIn, { error: "link", next }) : withQuery(signIn, { sent: "1", error: "code", next });
  if (!claim?.email || claim.otp.length !== 6) redirect(retry);

  const ip = await clientIp();
  if (ip !== null && !(await consume(`signin:check:${ip}`, LIMITS.signInChecksPerIp))) {
    redirect(withQuery(signIn, { error: "rate", next }));
  }
  let signedIn = false;
  try {
    await auth.api.signInEmailOTP({ body: { email: claim.email, otp: claim.otp }, headers: await headers() });
    signedIn = true;
  } catch {
    // Wrong, expired, used up or tried too often: the same answer for all of them.
  }
  if (!signedIn) redirect(retry);
  jar.delete(SIGN_IN_EMAIL_COOKIE);
  redirect(next);
}

export async function signOutAction(formData: FormData): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect(href(localeOf(formData)));
}

export async function saveEntryAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const slug = text(formData, "slug");
  const entryId = text(formData, "entryId") || null;
  const logPath = href(locale, "merkitse", slug);
  const back: Record<string, string> = entryId ? { entry: entryId } : {};
  // Signed out, a new entry is kept as a draft while the visitor signs in (see draft.ts).
  const user = entryId ? await requireUser(locale, logPath) : await getCurrentUser();

  const asOf = new Date();
  const context = await diary.getLogContext(user?.id ?? null, slug, asOf);
  if (!context) redirect(href(locale));
  if (!context.started && !entryId) redirect(href(locale, "esitys", slug));
  const parsed = parseEntryForm(formFields(formData), {
    performances: context.performances,
    tagSlugs: context.tags.map((tag) => tag.slug),
    asOf,
  });
  if (!parsed.ok) redirect(withQuery(logPath, { ...back, error: parsed.errors.join(",") }));
  const jar = await cookies();
  if (!user) {
    jar.set(DRAFT_COOKIE, sealDraft(slug, parsed.value, process.env.BETTER_AUTH_SECRET ?? ""), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DRAFT_MINUTES * 60,
    });
    redirect(signInHref(locale, withQuery(logPath, { draft: "1" })));
  }
  if (!entryId && !(await consume(`diary:${user.id}`, LIMITS.diarySaves))) {
    redirect(withQuery(logPath, { error: "rate" }));
  }

  const saved = await diary.saveEntry(user.id, context.production.id, entryId, parsed.value);
  if (!saved) redirect(logPath);
  if (!entryId) jar.delete(DRAFT_COOKIE);
  updateTag(productionTag(slug));
  redirect(withQuery(href(locale, "paivakirja"), { saved: saved.id }));
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const user = await requireUser(locale, href(locale, "paivakirja"));
  const slug = await diary.deleteEntry(user.id, text(formData, "entryId"));
  if (slug) updateTag(productionTag(slug));
  redirect(withQuery(href(locale, "paivakirja"), { deleted: "1" }));
}

export async function reportAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const entryId = text(formData, "entryId");
  const reportPath = href(locale, "ilmoita", entryId);
  const user = await requireUser(locale, reportPath);
  const reason = z.enum(ReportReason).safeParse(text(formData, "reason"));
  if (!reason.success) redirect(reportPath);
  if (!(await consume(`report:${user.id}`, LIMITS.reports))) redirect(withQuery(reportPath, { error: "rate" }));

  const result = await diary.reportEntry(user.id, entryId, reason.data);
  if (result.hidden && result.slug) updateTag(productionTag(result.slug));
  redirect(withQuery(reportPath, { done: result.outcome }));
}

export async function updateNameAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const settings = href(locale, "asetukset");
  const user = await requireUser(locale, settings);
  await diary.updateName(user.id, text(formData, "name"));
  // The name shows next to public reviews on every production the user reviewed.
  for (const entry of await diary.getDiary(user.id)) updateTag(productionTag(entry.production.slug));
  redirect(withQuery(settings, { saved: "1" }));
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const settings = href(locale, "asetukset");
  const user = await requireUser(locale, settings);
  if (text(formData, "confirm") !== "on") redirect(withQuery(settings, { error: "confirm" }));

  await auth.api.signOut({ headers: await headers() });
  for (const slug of await diary.deleteAccount(user.id)) updateTag(productionTag(slug));
  redirect(withQuery(href(locale), { accountDeleted: "1" }));
}

export async function digestAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const settings = href(locale, "asetukset");
  const user = await requireUser(locale, settings);
  // An unticked checkbox sends nothing, which means "off".
  await setDigest(user.id, text(formData, "digest") === "on", locale);
  redirect(`${withQuery(settings, { saved: "digest" })}#kooste`);
}

/** No session needed: the signed link from the email is the proof. */
export async function unsubscribeAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const page = href(locale, "peru-tilaus");
  const done = await unsubscribe(text(formData, "u"), text(formData, "s"));
  redirect(withQuery(page, done ? { done: "1" } : { error: "invalid" }));
}

/**
 * "Haluan nähdä" from a show's public (static) page: one tap when signed in. Signed out,
 * it goes through sign-in to the list page, which asks once more before adding, because
 * a GET after the sign-in link must not change anything.
 */
export async function watchAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const slug = text(formData, "slug");
  const list = href(locale, "haluan-nahda");
  const user = await getCurrentUser();
  if (!user) redirect(signInHref(locale, withQuery(list, { lisaa: slug })));
  if (!(await consume(`watch:${user.id}`, LIMITS.watchAdds))) redirect(withQuery(list, { error: "rate" }));
  const added = await addToWatchlist(user.id, slug);
  redirect(added ? withQuery(list, { lisatty: slug }) : list);
}

export async function unwatchAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const list = href(locale, "haluan-nahda");
  const user = await requireUser(locale, list);
  await removeFromWatchlist(user.id, text(formData, "slug"));
  redirect(withQuery(list, { poistettu: "1" }));
}
