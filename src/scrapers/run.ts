import type { PrismaClient } from "@/generated/prisma/client";
import { hktAdapter } from "./adapters/hkt";
import { kansallisteatteriAdapter } from "./adapters/kansallisteatteri";
import { svenskaTeaternAdapter } from "./adapters/svenska-teatern";
import { planProduction, upsertProduction } from "./normalise";
import type { RawProductionDetail, SourceAdapter } from "./types";

export const ADAPTERS: Record<string, SourceAdapter> = {
  [kansallisteatteriAdapter.id]: kansallisteatteriAdapter,
  [svenskaTeaternAdapter.id]: svenskaTeaternAdapter,
  [hktAdapter.id]: hktAdapter,
};

/** Error text including the `cause` chain, so "fetch failed" also says why (DNS, TLS, proxy...). */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause === undefined ? error.message : `${error.message}: ${describeError(error.cause)}`;
}

export interface RunOptions {
  dryRun: boolean;
  /** Only fetch details for the first N productions (handy while developing). */
  limit?: number;
  log?: (line: string) => void;
}

export interface RunResult {
  sourceId: string;
  found: number;
  saved: number;
  failed: Array<{ url: string; error: string }>;
  aborted?: string;
}

/**
 * Safety check: a source that suddenly returns nothing, or less than half of
 * what the previous successful run found, is probably broken (site redesign).
 */
export function looksBroken(found: number, previousFound: number | undefined): string | undefined {
  if (found === 0) return "source returned 0 productions";
  if (previousFound && found < previousFound * 0.5) {
    return `source returned ${found} productions, previous successful run found ${previousFound}`;
  }
  return undefined;
}

export async function runSource(
  db: PrismaClient | null,
  adapter: SourceAdapter,
  options: RunOptions,
): Promise<RunResult> {
  const log = options.log ?? console.log;
  const result: RunResult = { sourceId: adapter.id, found: 0, saved: 0, failed: [] };

  const theatre = db ? await db.theatre.findUnique({ where: { sourceId: adapter.id } }) : null;
  if (db && !theatre) throw new Error(`No theatre with sourceId "${adapter.id}". Run the seed first.`);

  const run = db && !options.dryRun
    ? await db.scrapeRun.create({ data: { sourceId: adapter.id } })
    : null;

  try {
    const list = await adapter.fetchProductions();
    result.found = list.length;
    log(`${adapter.id}: ${list.length} productions listed`);

    const previous = db
      ? await db.scrapeRun.findFirst({
          where: { sourceId: adapter.id, status: "SUCCESS" },
          orderBy: { startedAt: "desc" },
        })
      : null;
    const broken = looksBroken(list.length, previous?.itemsFound);
    if (broken) {
      result.aborted = broken;
      throw new Error(broken);
    }

    const seenAt = new Date();
    const targets = options.limit ? list.slice(0, options.limit) : list;
    for (const ref of targets) {
      let detail: RawProductionDetail;
      try {
        detail = await adapter.fetchProductionDetail(ref);
      } catch (error) {
        const message = describeError(error);
        result.failed.push({ url: ref.url, error: message });
        log(`  ✗ ${ref.title}: ${message}`);
        continue;
      }

      if (options.dryRun || !db || !theatre) {
        const { classification } = planProduction(detail);
        log(
          `  • ${detail.title} [${classification.type} ${classification.confidence}] ` +
            `stage=${detail.stage ?? "?"} performances=${detail.performances.length} ` +
            `credits=${detail.credits.length} reviews=${detail.criticReviews.length}`,
        );
        result.saved += 1;
        continue;
      }

      const summary = await upsertProduction(db, theatre, detail, seenAt);
      result.saved += 1;
      log(`  ${summary.created ? "+" : "~"} ${summary.slug} (${summary.performances} perf, ${summary.credits} credits)`);
    }

    if (run && db) {
      await db.scrapeRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          itemsFound: result.found,
          itemsChanged: result.saved,
          errors: result.failed.length ? result.failed : undefined,
        },
      });
    }
    return result;
  } catch (error) {
    if (run && db) {
      await db.scrapeRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          itemsFound: result.found,
          errors: { message: describeError(error), failed: result.failed },
        },
      });
    }
    throw error;
  }
}
