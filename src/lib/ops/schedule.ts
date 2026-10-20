/** Minimal view of a ScrapeRun row for scheduling and health decisions. */
export interface RunSummary {
  sourceId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: Date;
  itemsFound: number;
  failedDetails: number;
}

const HOUR = 60 * 60_000;
/** Scraping rule: at most once a day per source, with slack for cron jitter. */
export const MIN_HOURS_BETWEEN_RUNS = 20;
/** A RUNNING row older than this was killed (function time limit) and never finished. */
export const STUCK_AFTER_MINUTES = 15;

/** Skip when the source already succeeded recently (a retried or manual trigger). */
export function ranRecently(runs: RunSummary[], sourceId: string, now: Date): boolean {
  return runs.some(
    (run) =>
      run.sourceId === sourceId &&
      run.status === "SUCCESS" &&
      now.getTime() - run.startedAt.getTime() < MIN_HOURS_BETWEEN_RUNS * HOUR,
  );
}

/** For a single cron: the source whose latest run is oldest (never-run sources first). */
export function nextSource(sourceIds: string[], runs: RunSummary[]): string | null {
  const latest = (id: string) =>
    Math.max(-Infinity, ...runs.filter((run) => run.sourceId === id).map((run) => run.startedAt.getTime()));
  return [...sourceIds].sort((a, b) => latest(a) - latest(b))[0] ?? null;
}

export type Health = "ok" | "partial" | "failed" | "stuck" | "running" | "never";

/** How a source looks from its latest run. */
export function health(latest: RunSummary | undefined, now: Date): Health {
  if (!latest) return "never";
  if (latest.status === "FAILED") return "failed";
  if (latest.status === "RUNNING") {
    return now.getTime() - latest.startedAt.getTime() > STUCK_AFTER_MINUTES * 60_000 ? "stuck" : "running";
  }
  return latest.itemsFound > 0 && latest.failedDetails / latest.itemsFound > 0.25 ? "partial" : "ok";
}

/** Daily runs with Hobby's cron jitter (up to ~an hour late) plus slack: past this, a source is stale. */
export const OVERDUE_AFTER_HOURS = 26;

/** Sources without a successful run in the last OVERDUE_AFTER_HOURS (never-run ones included). */
export function overdueSources(sourceIds: string[], runs: RunSummary[], now: Date): string[] {
  return sourceIds.filter(
    (id) =>
      !runs.some(
        (run) => run.sourceId === id && run.status === "SUCCESS" && now.getTime() - run.startedAt.getTime() <= OVERDUE_AFTER_HOURS * HOUR,
      ),
  );
}

/** Whether a finished run deserves an email to the admins. */
export function needsAlert(status: Health): boolean {
  return status === "failed" || status === "partial" || status === "stuck";
}
