import { cardSelect, toCard } from "@/lib/catalogue/cards";
import type { ProductionCard } from "@/lib/catalogue/types";
import { db } from "@/lib/db";

/**
 * "Haluan nähdä": shows a user means to see. Private, never counted anywhere public.
 * An item goes away when the user logs the show as seen (saveEntry) or removes it.
 */
export interface Watchlist {
  /** Still playing, soonest first, then those still waiting for dates. */
  playing: ProductionCard[];
  /** No upcoming performances any more, most recently saved first. */
  gone: ProductionCard[];
}

/** Adds by slug; false when no such production exists. Adding twice is harmless. */
export async function addToWatchlist(userId: string, slug: string): Promise<boolean> {
  const production = await db.production.findUnique({ where: { slug }, select: { id: true } });
  if (!production) return false;
  await db.watchItem.upsert({
    where: { userId_productionId: { userId, productionId: production.id } },
    create: { userId, productionId: production.id },
    update: {},
  });
  return true;
}

export async function removeFromWatchlist(userId: string, slug: string): Promise<void> {
  await db.watchItem.deleteMany({ where: { userId, production: { slug } } });
}

/** Seen it: it no longer belongs on the list. */
export async function clearWatched(userId: string, productionId: string): Promise<void> {
  await db.watchItem.deleteMany({ where: { userId, productionId } });
}

export async function isOnWatchlist(userId: string, slug: string): Promise<boolean> {
  return (await db.watchItem.count({ where: { userId, production: { slug } } })) > 0;
}

export async function watchlistCount(userId: string): Promise<number> {
  return db.watchItem.count({ where: { userId } });
}

export async function getWatchlist(userId: string, asOf: Date): Promise<Watchlist> {
  const items = await db.watchItem.findMany({
    where: { userId },
    select: { production: { select: cardSelect } },
    orderBy: { createdAt: "desc" },
  });
  const cards = items.map((item) => toCard(item.production, asOf));
  return {
    // Not-yet-dated productions stay on the list, after the dated ones.
    playing: cards
      .filter((card) => card.phase === "running" || card.phase === "upcoming")
      .sort((a, b) => (a.next?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.next?.getTime() ?? Number.MAX_SAFE_INTEGER)),
    gone: cards.filter((card) => card.phase === "past" || card.phase === "archive"),
  };
}

/** For the confirmation after signing in: the title of a slug, or null if it doesn't exist. */
export async function productionTitle(slug: string): Promise<string | null> {
  const production = await db.production.findUnique({ where: { slug }, select: { title: true } });
  return production?.title ?? null;
}
