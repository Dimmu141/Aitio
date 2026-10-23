import "dotenv/config";
import { db } from "../src/lib/db";
import { scheduledScrape, type ScrapeOutcome } from "../src/lib/ops/scrape";
import { ADAPTERS } from "../src/scrapers/run";
import { revalidateRemote } from "./revalidate";

/**
 * The nightly scrape, run by GitHub Actions (.github/workflows/scrape.yml) instead of
 * Vercel Cron: same once-a-day rule, run log and admin alerts as the cron route, but the
 * CPU is GitHub's. The page cache is cleared once at the end, not after every source.
 *
 * Usage: pnpm scrape:scheduled [sourceId ...]   (default: every source)
 * Needs DATABASE_URL, SITE_URL and REVALIDATE_SECRET; ADMIN_EMAILS and an email key for alerts.
 */
function describe(outcome: ScrapeOutcome): string {
  if (outcome.skipped) return `${outcome.sourceId}: skipped (${outcome.skipped})`;
  if (outcome.error) return `${outcome.sourceId}: FAILED: ${outcome.error}`;
  return `${outcome.sourceId}: ${outcome.saved}/${outcome.found} saved, ${outcome.failed} failed, ${outcome.health}`;
}

async function main(): Promise<number> {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const sourceIds = requested.length > 0 ? requested : Object.keys(ADAPTERS);
  const outcomes: ScrapeOutcome[] = [];
  for (const id of sourceIds) {
    const outcome = await scheduledScrape(id);
    console.log(describe(outcome));
    outcomes.push(outcome);
  }

  let exitCode = outcomes.some((outcome) => outcome.error || outcome.skipped === "unknown source") ? 1 : 0;
  if (outcomes.some((outcome) => !outcome.error && !outcome.skipped)) {
    const cleared = await revalidateRemote(["catalogue"]);
    if (cleared === null) console.error("SITE_URL or REVALIDATE_SECRET not set: pages update within the hour.");
    if (!cleared) exitCode = 1;
    else console.log("Page cache cleared.");
  }
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    // Like `pnpm scrape`: don't let an idle keep-alive socket hold the job open.
    process.exit();
  });
