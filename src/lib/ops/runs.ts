import type { ScrapeStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { STUCK_AFTER_MINUTES, type RunSummary } from "./schedule";

/** ScrapeRun.errors is either an array of failed details or { message, failed }. */
export function failedDetailCount(errors: unknown): number {
  if (Array.isArray(errors)) return errors.length;
  if (errors && typeof errors === "object" && "failed" in errors && Array.isArray(errors.failed)) return errors.failed.length;
  return 0;
}

export function errorMessage(errors: unknown): string | null {
  return errors && typeof errors === "object" && "message" in errors && typeof errors.message === "string"
    ? errors.message
    : null;
}

export interface RunRow extends RunSummary {
  id: string;
  finishedAt: Date | null;
  itemsChanged: number;
  message: string | null;
}

export async function recentRuns(limit = 200): Promise<RunRow[]> {
  const rows = await db.scrapeRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    status: row.status as ScrapeStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    itemsFound: row.itemsFound,
    itemsChanged: row.itemsChanged,
    failedDetails: failedDetailCount(row.errors),
    message: errorMessage(row.errors),
  }));
}

/** Runs killed by the function time limit never write their end: close them as failed. */
export async function closeStuckRuns(now: Date): Promise<number> {
  const { count } = await db.scrapeRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000) } },
    data: { status: "FAILED", finishedAt: now, errors: { message: "timed out (function time limit?)", failed: [] } },
  });
  return count;
}
