/**
 * ensureStatic = "navigation" needs at least one param set at build time. On an empty
 * database (fresh setup, preview branch) we hand it a slug that renders as a 404.
 */
export const PLACEHOLDER_SLUG = "_";

export function withPlaceholder(params: Array<{ slug: string }>): Array<{ slug: string }> {
  return params.length > 0 ? params : [{ slug: PLACEHOLDER_SLUG }];
}
