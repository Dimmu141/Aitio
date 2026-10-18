"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { auth } from "@/lib/auth";
import { CLIENT_IP_HEADERS } from "@/lib/auth-config";
import { productionTag } from "@/lib/catalogue/tags";
import { formFields, parseEntryForm } from "@/lib/diary/entry-form";
import * as diary from "@/lib/diary/service";
import { consume, LIMITS } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { requireUser } from "@/lib/session";

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
    (await consume(`magic:email:${email.data}`, LIMITS.magicLinkPerEmail)) &&
    (ip === null || (await consume(`magic:ip:${ip}`, LIMITS.magicLinkPerIp)));
  if (!allowed) redirect(withQuery(signIn, { error: "rate", next }));

  try {
    await auth.api.signInMagicLink({
      body: { email: email.data, callbackURL: next, newUserCallbackURL: next, errorCallbackURL: signIn, metadata: { locale } },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Sending the sign-in link failed", error);
    redirect(withQuery(signIn, { error: "send", next }));
  }
  redirect(withQuery(signIn, { sent: "1", next }));
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
  const user = await requireUser(locale, logPath);

  const asOf = new Date();
  const context = await diary.getLogContext(user.id, slug, asOf);
  if (!context) redirect(href(locale));
  const parsed = parseEntryForm(formFields(formData), {
    performances: context.performances,
    tagSlugs: context.tags.map((tag) => tag.slug),
    asOf,
  });
  if (!parsed.ok) redirect(withQuery(logPath, { ...back, error: parsed.errors.join(",") }));
  if (!entryId && !(await consume(`diary:${user.id}`, LIMITS.diarySaves))) {
    redirect(withQuery(logPath, { error: "rate" }));
  }

  const saved = await diary.saveEntry(user.id, context.production.id, entryId, parsed.value);
  if (!saved) redirect(logPath);
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
