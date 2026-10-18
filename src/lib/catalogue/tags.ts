/** Cache tag for one production's page data, invalidated when its diary entries change. */
export function productionTag(slug: string): string {
  return `production:${slug}`;
}
