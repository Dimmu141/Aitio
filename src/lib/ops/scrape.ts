import { revalidateTag } from "next/cache";
import { CATALOGUE_TAG } from "@/lib/catalogue/queries";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";
import { ADAPTERS, describeError, runSource } from "@/scrapers/run";
import { adminEmails } from "./admin";
import { closeStuckRuns, recentRuns } from "./runs";
import { health, needsAlert, nextSource, ranRecently, type Health } from "./schedule";

export interface ScrapeOutcome {
  sourceId: string;
  skipped?: string;
  health?: Health;
  found?: number;
  saved?: number;
  failed?: number;
  error?: string;
}

/**
 * One scheduled run of one source: close runs that died, respect the once-a-day rule,
 * scrape, refresh the cached catalogue, and email the admins if the result looks wrong.
 * `sourceId` "next" picks the source whose last run is oldest (single-cron setups).
 */
export async function scheduledScrape(sourceId: string, now = new Date()): Promise<ScrapeOutcome> {
  await closeStuckRuns(now);
  const runs = await recentRuns();
  const id = sourceId === "next" ? nextSource(Object.keys(ADAPTERS), runs) : sourceId;
  const adapter = id ? ADAPTERS[id] : undefined;
  if (!id || !adapter) return { sourceId, skipped: "unknown source" };
  if (ranRecently(runs, id, now)) return { sourceId: id, skipped: "already scraped in the last 20 hours" };

  const log: string[] = [];
  let outcome: ScrapeOutcome;
  try {
    const result = await runSource(db, adapter, { dryRun: false, log: (line) => log.push(line) });
    outcome = { sourceId: id, found: result.found, saved: result.saved, failed: result.failed.length };
  } catch (error) {
    outcome = { sourceId: id, error: describeError(error) };
  }

  const latest = (await recentRuns(5)).find((run) => run.sourceId === id);
  outcome.health = health(latest, new Date());
  if (!outcome.error) revalidateTag(CATALOGUE_TAG, "max");
  if (needsAlert(outcome.health)) await alertAdmins(outcome, log);
  return outcome;
}

async function alertAdmins(outcome: ScrapeOutcome, log: string[]): Promise<void> {
  const recipients = adminEmails();
  if (recipients.length === 0) return;
  const lines = [
    `Lähde: ${outcome.sourceId}`,
    `Tila: ${outcome.health}`,
    outcome.error ? `Virhe: ${outcome.error}` : `Löytyi ${outcome.found}, tallennettu ${outcome.saved}, epäonnistui ${outcome.failed}.`,
    "",
    `Seuranta: ${absoluteUrl("/yllapito")}`,
    "",
    ...log.slice(-30),
  ];
  for (const to of recipients) {
    await sendEmail({ to, subject: `Aitio: haku ${outcome.sourceId} – ${outcome.health}`, text: lines.join("\n") }).catch(
      (error: unknown) => console.error("Alert email failed", error),
    );
  }
}
