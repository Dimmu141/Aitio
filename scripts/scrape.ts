import "dotenv/config";
import { ADAPTERS, runSource } from "../src/scrapers/run";

/**
 * Usage:
 *   pnpm scrape                         # all sources, writes to the database
 *   pnpm scrape kansallisteatteri       # one source
 *   pnpm scrape svenska-teatern --dry-run --limit 5
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;
  const sourceIds = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--limit");
  const selected = sourceIds.length > 0 ? sourceIds : Object.keys(ADAPTERS);

  const unknown = selected.filter((id) => !ADAPTERS[id]);
  if (unknown.length > 0) {
    console.error(`Unknown source(s): ${unknown.join(", ")}. Known: ${Object.keys(ADAPTERS).join(", ")}`);
    process.exit(1);
  }

  const db = dryRun ? null : (await import("../src/lib/db")).db;
  let exitCode = 0;
  for (const id of selected) {
    try {
      const result = await runSource(db, ADAPTERS[id], { dryRun, limit });
      console.log(`${id}: ${result.saved}/${result.found} processed, ${result.failed.length} failed${dryRun ? " (dry run, nothing saved)" : ""}`);
    } catch (error) {
      exitCode = 1;
      console.error(`${id}: run failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await db?.$disconnect();
  process.exit(exitCode);
}

void main();
