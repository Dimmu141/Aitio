/**
 * The scrapers never delete: a performance that vanished from the theatre's
 * site (cancelled, moved) keeps its row with a stale lastSeenAt. Every row
 * written in one scrape run shares the run's timestamp, so a performance is
 * current only if it was seen in the same run as its production.
 */
export function currentPerformances<T extends { lastSeenAt: Date }>(performances: T[], productionSeenAt: Date): T[] {
  return performances.filter((performance) => performance.lastSeenAt.getTime() >= productionSeenAt.getTime());
}
