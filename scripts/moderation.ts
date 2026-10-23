import "dotenv/config";
import { db } from "../src/lib/db";
import { moderate, moderationQueue } from "../src/lib/diary/service";
import { productionTag } from "../src/lib/catalogue/tags";
import { revalidateRemote } from "./revalidate";

/**
 * Usage:
 *   pnpm moderation                 # list reviews with open reports
 *   pnpm moderation hide <entryId>  # hide the review and close its reports
 *   pnpm moderation show <entryId>  # show it again (e.g. auto-hidden unfairly) and close its reports
 * With SITE_URL and REVALIDATE_SECRET set, the production page updates immediately.
 */
async function revalidate(slug: string): Promise<void> {
  const cleared = await revalidateRemote([productionTag(slug)]);
  if (cleared === null) console.log("SITE_URL or REVALIDATE_SECRET not set: the page updates within the hour.");
  else if (cleared) console.log("Page cache cleared.");
}

async function list(): Promise<void> {
  const queue = await moderationQueue();
  if (queue.length === 0) console.log("No open reports.");
  for (const item of queue) {
    const reasons = Object.entries(item.reasons).map(([reason, n]) => `${reason} ×${n}`).join(", ");
    console.log(`\n${item.entryId}  ${item.production}${item.hidden ? "  [auto-hidden]" : ""}`);
    console.log(`  by ${item.author}: ${reasons}`);
    console.log(`  "${item.review.replace(/\s+/g, " ").slice(0, 300)}"`);
  }
}

async function main(): Promise<void> {
  const [command, entryId] = process.argv.slice(2);
  if (!command) return list();
  if ((command !== "hide" && command !== "show") || !entryId) {
    throw new Error("Usage: pnpm moderation [hide|show <entryId>]");
  }
  const slug = await moderate(entryId, command === "hide");
  if (!slug) throw new Error(`No diary entry ${entryId}`);
  console.log(`${command === "hide" ? "Hidden" : "Shown"}: ${entryId}`);
  await revalidate(slug);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
