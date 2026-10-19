import type { ReportReason } from "@/generated/prisma/enums";
import { isCurrent, lifecycle } from "@/lib/catalogue/select";
import { db } from "@/lib/db";
import type { EntryInput } from "./entry-form";
import { clearWatched } from "./watchlist";

/** Distinct open reports that hide a review until someone looks at it. */
export const AUTO_HIDE_REPORTS = 3;
export const MAX_NAME_LENGTH = 40;
const LOG_WINDOW_DAYS = 60;

export interface LogContext {
  production: { id: string; slug: string; title: string; theatre: string; stage: string | null };
  /** Past performances still on the theatre's page, newest first. */
  performances: Array<{ id: string; startsAt: Date; stage: string | null }>;
  tags: Array<{ slug: string; labelFi: string; labelSv: string; labelEn: string }>;
  earlier: Array<{ id: string; seenOn: Date; rating: number | null }>;
  userName: string;
  /** False before the first performance: there is nothing to have seen yet. */
  started: boolean;
}

/** Signed out (`userId` null), there are no earlier entries and no name: the form fills a draft. */
export async function getLogContext(userId: string | null, slug: string, asOf: Date): Promise<LogContext | null> {
  const since = new Date(asOf.getTime() - LOG_WINDOW_DAYS * 86_400_000);
  const production = await db.production.findUnique({
    where: { slug },
    include: {
      theatre: { select: { name: true } },
      stage: { select: { name: true } },
      performances: {
        where: { startsAt: { gte: since, lte: asOf } },
        include: { stage: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
      },
    },
  });
  if (!production) return null;
  const [tags, earlier, user, first] = await Promise.all([
    db.tag.findMany({ orderBy: { sortOrder: "asc" } }),
    userId
      ? db.diaryEntry.findMany({
          where: { userId, productionId: production.id },
          select: { id: true, seenOn: true, rating: true },
          orderBy: { seenOn: "desc" },
        })
      : [],
    userId ? db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }) : { name: "" },
    // The earliest is enough for `started`: past means performed, future still counts unless a premiere is ahead.
    db.performance.findFirst({ where: { productionId: production.id }, select: { startsAt: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const { started } = lifecycle({ ...production, next: null, performances: first ? [first] : [] }, asOf);
  return {
    production: {
      id: production.id,
      slug: production.slug,
      title: production.title,
      theatre: production.theatre.name,
      stage: production.stage?.name ?? null,
    },
    performances: production.performances
      .filter((performance) => isCurrent(performance, production))
      .slice(0, 8)
      .map((performance) => ({ id: performance.id, startsAt: performance.startsAt, stage: performance.stage?.name ?? null })),
    tags: tags.map(({ slug: tagSlug, labelFi, labelSv, labelEn }) => ({ slug: tagSlug, labelFi, labelSv, labelEn })),
    earlier,
    userName: user.name,
    started,
  };
}

export interface EditableEntry {
  id: string;
  performanceId: string | null;
  seenOn: Date;
  rating: number | null;
  review: string | null;
  isPublic: boolean;
  isRewatch: boolean;
  tagSlugs: string[];
}

/** Only the owner's own entry for this production; anything else reads as missing. */
export async function getOwnEntry(userId: string, productionId: string, entryId: string): Promise<EditableEntry | null> {
  const entry = await db.diaryEntry.findFirst({
    where: { id: entryId, userId, productionId },
    include: { tags: { select: { slug: true } } },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    performanceId: entry.performanceId,
    seenOn: entry.seenOn,
    rating: entry.rating,
    review: entry.review,
    isPublic: entry.isPublic,
    isRewatch: entry.isRewatch,
    tagSlugs: entry.tags.map((tag) => tag.slug),
  };
}

/** Create, or update the user's own entry. Returns null when entryId isn't theirs. */
export async function saveEntry(
  userId: string,
  productionId: string,
  entryId: string | null,
  input: EntryInput,
): Promise<{ id: string } | null> {
  const data = {
    performanceId: input.performanceId,
    seenOn: new Date(`${input.seenOn}T00:00:00Z`),
    rating: input.rating,
    review: input.review,
    isPublic: input.isPublic,
    isRewatch: input.isRewatch,
    tags: { set: [], connect: input.tagSlugs.map((slug) => ({ slug })) },
  };
  if (entryId) {
    const owned = await db.diaryEntry.findFirst({
      where: { id: entryId, userId, productionId },
      select: { id: true, review: true, hiddenAt: true, _count: { select: { reports: { where: { resolvedAt: null } } } } },
    });
    if (!owned) return null;
    return db.diaryEntry.update({
      where: { id: entryId },
      data: { ...data, ...(await afterReviewEdit(owned, input.review)) },
      select: { id: true },
    });
  }
  const { tags, ...rest } = data;
  await clearWatched(userId, productionId);
  return db.diaryEntry.create({
    data: { ...rest, userId, productionId, tags: { connect: tags.connect } },
    select: { id: true },
  });
}

/**
 * Moderation state after the author saves. Only a changed text is a new review: earlier
 * reports were about the old one, so they close, and an automatic hide (open reports)
 * lifts. A moderator's hide (reports already resolved) stays, so a trivial edit can't
 * undo it; changing only the rating, tags or date changes nothing here.
 */
async function afterReviewEdit(
  entry: { id: string; review: string | null; hiddenAt: Date | null; _count: { reports: number } },
  review: string | null,
): Promise<{ hiddenAt?: null }> {
  if ((entry.review ?? "") === (review ?? "")) return {};
  await db.report.updateMany({ where: { entryId: entry.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  const autoHidden = entry.hiddenAt !== null && entry._count.reports > 0;
  return autoHidden ? { hiddenAt: null } : {};
}

/** Delete the user's own entry; returns the production slug for cache invalidation. */
export async function deleteEntry(userId: string, entryId: string): Promise<string | null> {
  const entry = await db.diaryEntry.findFirst({
    where: { id: entryId, userId },
    select: { id: true, production: { select: { slug: true } } },
  });
  if (!entry) return null;
  await db.diaryEntry.delete({ where: { id: entry.id } });
  return entry.production.slug;
}

export interface DiaryEntryView {
  id: string;
  seenOn: Date;
  rating: number | null;
  review: string | null;
  isPublic: boolean;
  isRewatch: boolean;
  hidden: boolean;
  tags: Array<{ slug: string; labelFi: string; labelSv: string; labelEn: string }>;
  production: { slug: string; title: string; theatre: string; stage: string | null };
  performanceStage: string | null;
}

export async function getDiary(userId: string): Promise<DiaryEntryView[]> {
  const entries = await db.diaryEntry.findMany({
    where: { userId },
    include: {
      tags: { orderBy: { sortOrder: "asc" } },
      performance: { select: { stage: { select: { name: true } } } },
      production: { select: { slug: true, title: true, theatre: { select: { name: true } }, stage: { select: { name: true } } } },
    },
    orderBy: [{ seenOn: "desc" }, { createdAt: "desc" }],
  });
  return entries.map((entry) => ({
    id: entry.id,
    seenOn: entry.seenOn,
    rating: entry.rating,
    review: entry.review,
    isPublic: entry.isPublic,
    isRewatch: entry.isRewatch,
    hidden: entry.hiddenAt !== null,
    tags: entry.tags.map(({ slug, labelFi, labelSv, labelEn }) => ({ slug, labelFi, labelSv, labelEn })),
    production: {
      slug: entry.production.slug,
      title: entry.production.title,
      theatre: entry.production.theatre.name,
      stage: entry.production.stage?.name ?? null,
    },
    performanceStage: entry.performance?.stage?.name ?? null,
  }));
}

export type ReportOutcome = "reported" | "already" | "own" | "missing";

/** Record a report; enough distinct open reports hide the review until moderation. */
export async function reportEntry(
  reporterId: string,
  entryId: string,
  reason: ReportReason,
): Promise<{ outcome: ReportOutcome; slug?: string; hidden?: boolean }> {
  const entry = await db.diaryEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, review: true, isPublic: true, updatedAt: true, production: { select: { slug: true } } },
  });
  if (!entry || !entry.review || !entry.isPublic) return { outcome: "missing" };
  if (entry.userId === reporterId) return { outcome: "own" };

  // One report per person per review text: a report resolved before the entry was last
  // edited was about older text, so it can be raised again.
  const existing = await db.report.findUnique({ where: { entryId_reporterId: { entryId, reporterId } } });
  const reopenable = existing?.resolvedAt && existing.resolvedAt < entry.updatedAt;
  if (existing && !reopenable) return { outcome: "already", slug: entry.production.slug };
  if (existing) {
    await db.report.update({ where: { id: existing.id }, data: { reason, resolvedAt: null, createdAt: new Date() } });
  } else {
    await db.report.create({ data: { entryId, reporterId, reason } });
  }

  const open = await db.report.count({ where: { entryId, resolvedAt: null } });
  const hidden = open >= AUTO_HIDE_REPORTS;
  if (hidden) await db.diaryEntry.update({ where: { id: entryId }, data: { hiddenAt: new Date() } });
  return { outcome: "reported", slug: entry.production.slug, hidden };
}

export async function updateName(userId: string, name: string): Promise<string> {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  await db.user.update({ where: { id: userId }, data: { name: clean } });
  return clean;
}

/** Delete the account and everything hanging off it; returns the slugs whose aggregates changed. */
export async function deleteAccount(userId: string): Promise<string[]> {
  const entries = await db.diaryEntry.findMany({
    where: { userId },
    select: { production: { select: { slug: true } } },
  });
  await db.user.delete({ where: { id: userId } });
  return [...new Set(entries.map((entry) => entry.production.slug))];
}

/** Everything we hold about a user, for the GDPR download. */
export async function exportData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, locale: true, digestOptIn: true, digestSentAt: true, createdAt: true },
  });
  const entries = await getDiary(userId);
  const reports = await db.report.findMany({
    where: { reporterId: userId },
    select: { entryId: true, reason: true, createdAt: true },
  });
  // Everything stored about the sign-ins except the token itself, which is a credential.
  const watchlist = await db.watchItem.findMany({
    where: { userId },
    select: { createdAt: true, production: { select: { title: true, theatre: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const sessions = await db.session.findMany({
    where: { userId },
    select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    exportedAt: new Date().toISOString(),
    user,
    diary: entries.map((entry) => ({
      production: entry.production.title,
      theatre: entry.production.theatre,
      seenOn: entry.seenOn.toISOString().slice(0, 10),
      rating: entry.rating === null ? null : entry.rating / 2,
      review: entry.review,
      isPublic: entry.isPublic,
      isRewatch: entry.isRewatch,
      tags: entry.tags.map((tag) => tag.slug),
    })),
    watchlist: watchlist.map((item) => ({
      production: item.production.title,
      theatre: item.production.theatre.name,
      savedAt: item.createdAt.toISOString(),
    })),
    reports,
    sessions,
  };
}

export interface ModerationItem {
  entryId: string;
  production: string;
  slug: string;
  author: string;
  review: string;
  hidden: boolean;
  reasons: Record<string, number>;
}

/** Entries with open reports, most reported first. */
export async function moderationQueue(): Promise<ModerationItem[]> {
  const entries = await db.diaryEntry.findMany({
    where: { reports: { some: { resolvedAt: null } } },
    include: {
      reports: { where: { resolvedAt: null }, select: { reason: true } },
      user: { select: { email: true } },
      production: { select: { title: true, slug: true } },
    },
  });
  return entries
    .map((entry) => ({
      entryId: entry.id,
      production: entry.production.title,
      slug: entry.production.slug,
      author: entry.user.email,
      review: entry.review ?? "",
      hidden: entry.hiddenAt !== null,
      reasons: entry.reports.reduce<Record<string, number>>((counts, report) => {
        counts[report.reason] = (counts[report.reason] ?? 0) + 1;
        return counts;
      }, {}),
    }))
    .sort((a, b) => sum(b.reasons) - sum(a.reasons));
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, n) => total + n, 0);

/** A moderator's decision: hide or show the review, and close its open reports. */
export async function moderate(entryId: string, hide: boolean): Promise<string | null> {
  const entry = await db.diaryEntry.findUnique({ where: { id: entryId }, select: { production: { select: { slug: true } } } });
  if (!entry) return null;
  await db.diaryEntry.update({ where: { id: entryId }, data: { hiddenAt: hide ? new Date() : null } });
  await db.report.updateMany({ where: { entryId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  return entry.production.slug;
}
