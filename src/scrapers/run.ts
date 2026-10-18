import type { PrismaClient } from "@/generated/prisma/client";
import { avoimetOvetAdapter } from "./adapters/avoimet-ovet";
import { espoonTeatteriAdapter } from "./adapters/espoon-teatteri";
import { hktAdapter } from "./adapters/hkt";
import { kansallisoopperaAdapter } from "./adapters/kansallisooppera";
import { kansallisteatteriAdapter } from "./adapters/kansallisteatteri";
import { komTeatteriAdapter } from "./adapters/kom-teatteri";
import { qTeatteriAdapter } from "./adapters/q-teatteri";
import { ryhmateatteriAdapter } from "./adapters/ryhmateatteri";
import { svenskaTeaternAdapter } from "./adapters/svenska-teatern";
import { takomoAdapter } from "./adapters/takomo";
import { tanssinTaloAdapter } from "./adapters/tanssin-talo";
import { viirusAdapter } from "./adapters/viirus";
import { zodiakAdapter } from "./adapters/zodiak";
import { HttpError } from "./http";
import { planProduction, upsertProduction } from "./normalise";
import type { RawProductionDetail, SourceAdapter } from "./types";

export const ADAPTERS: Record<string, SourceAdapter> = {
  [kansallisteatteriAdapter.id]: kansallisteatteriAdapter,
  [svenskaTeaternAdapter.id]: svenskaTeaternAdapter,
  [hktAdapter.id]: hktAdapter,
  [ryhmateatteriAdapter.id]: ryhmateatteriAdapter,
  [komTeatteriAdapter.id]: komTeatteriAdapter,
  [espoonTeatteriAdapter.id]: espoonTeatteriAdapter,
  [kansallisoopperaAdapter.id]: kansallisoopperaAdapter,
  [zodiakAdapter.id]: zodiakAdapter,
  [tanssinTaloAdapter.id]: tanssinTaloAdapter,
  [qTeatteriAdapter.id]: qTeatteriAdapter,
  [takomoAdapter.id]: takomoAdapter,
  [viirusAdapter.id]: viirusAdapter,
  [avoimetOvetAdapter.id]: avoimetOvetAdapter,
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
  /** Listed by the theatre but its page answers 404: their broken link, not our failure. */
  missing: string[];
  aborted?: string;
}

/**
 * Productions the theatre stopped listing (cancelled, removed) are marked delisted so
 * their stored future dates stop counting as "on stage"; a listed one is cleared again.
 * A listed production whose page failed to load stays as it is. Returns how many were
 * newly delisted.
 */
export async function syncListing(db: PrismaClient, theatreId: string, listed: string[], at: Date): Promise<number> {
  await db.production.updateMany({
    where: { theatreId, externalId: { in: listed }, delistedAt: { not: null } },
    data: { delistedAt: null },
  });
  const result = await db.production.updateMany({
    where: { theatreId, externalId: { notIn: listed }, delistedAt: null },
    data: { delistedAt: at },
  });
  return result.count;
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
  const result: RunResult = { sourceId: adapter.id, found: 0, saved: 0, failed: [], missing: [] };

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
        if (error instanceof HttpError && error.status === 404) {
          result.missing.push(ref.url);
          log(`  – ${ref.title}: the theatre links to a page that doesn't exist (404)`);
          continue;
        }
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

    // Only a complete run knows what the theatre no longer lists.
    if (db && theatre && !options.dryRun && !options.limit) {
      const delisted = await syncListing(db, theatre.id, list.map((ref) => ref.externalId), seenAt);
      if (delisted > 0) log(`  ${delisted} no longer listed by the theatre`);
    }

    if (run && db) {
      await db.scrapeRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          itemsFound: result.found,
          itemsChanged: result.saved,
          errors:
            result.failed.length || result.missing.length ? { failed: result.failed, missing: result.missing } : undefined,
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
          errors: { message: describeError(error), failed: result.failed, missing: result.missing },
        },
      });
    }
    throw error;
  }
}
