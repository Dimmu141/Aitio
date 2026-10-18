import { isLocale, type Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { cardSelect, toCard } from "@/lib/catalogue/cards";
import { db } from "@/lib/db";
import { type EmailMessage, sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { composeDigest, digestItems, RESEND_AFTER_DAYS } from "./digest";
import { isValidUnsubscribe, unsubscribeSignature } from "./unsubscribe";

/** One run stays well inside the cron's 300 s at Resend's default 2 requests per second. */
export const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DigestOutcome {
  due: number;
  sent: number;
  /** Nothing closing that the user hasn't already seen. */
  empty: number;
  failed: number;
}

export interface DigestDeps {
  send: (message: EmailMessage) => Promise<void>;
  /** Between sends, to stay under the provider's rate limit. */
  pause: () => Promise<void>;
}

const defaultDeps: DigestDeps = {
  send: sendEmail,
  pause: () => new Promise((resolve) => setTimeout(resolve, process.env.RESEND_API_KEY ? 550 : 0)),
};

function unsubscribeQuery(userId: string): string {
  return new URLSearchParams({ u: userId, s: unsubscribeSignature(userId) }).toString();
}

/** For the List-Unsubscribe header: mail clients POST to it (RFC 8058 one-click). */
export function oneClickUrl(userId: string): string {
  return absoluteUrl(`/api/digest/unsubscribe?${unsubscribeQuery(userId)}`);
}

/** For the link in the text: a page with a button, so link scanners can't unsubscribe anyone. */
export function unsubscribePageUrl(userId: string, locale: Locale): string {
  return absoluteUrl(`${href(locale, "peru-tilaus")}?${unsubscribeQuery(userId)}`);
}

async function closingCards(asOf: Date) {
  const rows = await db.production.findMany({
    where: { performances: { some: { startsAt: { gte: asOf } } } },
    select: cardSelect,
  });
  return rows.map((row) => toCard(row, asOf)).filter((card) => card.closingSoon);
}

/** Weekly: every opted-in user who hasn't had this week's email yet, oldest first. */
export async function sendDigests(asOf: Date, deps: DigestDeps = defaultDeps): Promise<DigestOutcome> {
  const cards = await closingCards(asOf);
  const users = await db.user.findMany({
    where: {
      digestOptIn: true,
      OR: [{ digestSentAt: null }, { digestSentAt: { lte: new Date(asOf.getTime() - RESEND_AFTER_DAYS * DAY_MS) } }],
    },
    select: {
      id: true,
      email: true,
      locale: true,
      diaryEntries: { select: { production: { select: { slug: true } } } },
    },
    orderBy: [{ digestSentAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: BATCH_SIZE,
  });

  const outcome: DigestOutcome = { due: users.length, sent: 0, empty: 0, failed: 0 };
  for (const user of users) {
    const items = digestItems(cards, new Set(user.diaryEntries.map((entry) => entry.production.slug)));
    // Marked as handled either way, so an empty week isn't re-checked by every retry.
    if (items.length === 0) {
      outcome.empty += 1;
      await db.user.update({ where: { id: user.id }, data: { digestSentAt: asOf } });
      continue;
    }
    const locale: Locale = isLocale(user.locale) ? user.locale : "fi";
    const email = composeDigest(
      locale,
      items,
      { absolute: absoluteUrl, unsubscribeUrl: unsubscribePageUrl(user.id, locale) },
      asOf,
    );
    try {
      await deps.send({
        to: user.email,
        ...email,
        headers: { "List-Unsubscribe": `<${oneClickUrl(user.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      await db.user.update({ where: { id: user.id }, data: { digestSentAt: asOf } });
      outcome.sent += 1;
    } catch (error) {
      console.error(`Digest to user ${user.id} failed`, error);
      outcome.failed += 1;
    }
    await deps.pause();
  }
  return outcome;
}

/** From the unsubscribe page or a one-click POST; false when the link doesn't check out. */
export async function unsubscribe(userId: string, signature: string): Promise<boolean> {
  if (!userId || !isValidUnsubscribe(userId, signature)) return false;
  await db.user.updateMany({ where: { id: userId }, data: { digestOptIn: false } });
  return true;
}

export async function setDigest(userId: string, optIn: boolean, locale: Locale): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { digestOptIn: optIn, ...(optIn ? { locale } : {}) } });
}

export async function getDigestOptIn(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { digestOptIn: true } });
  return user?.digestOptIn ?? false;
}
