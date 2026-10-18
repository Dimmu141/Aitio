import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";

export const TABS = ["programme", "search", "diary", "settings"] as const;
export type Tab = (typeof TABS)[number];

function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Which tab a pathname belongs to; accepts the public URL or the internal `/fi/...` route. */
export function activeTab(pathname: string, locale: Locale): Tab | null {
  const diary = [href(locale, "paivakirja"), `/${locale}/paivakirja`, href(locale, "haluan-nahda"), `/${locale}/haluan-nahda`];
  const settings = [href(locale, "asetukset"), `/${locale}/asetukset`];
  const search = [href(locale, "haku"), `/${locale}/haku`];
  if (search.some((base) => within(pathname, base))) return "search";
  if (diary.some((base) => within(pathname, base))) return "diary";
  if (settings.some((base) => within(pathname, base))) return "settings";
  const programme = (["esitys", "teatteri", "henkilo"] as const).flatMap((section) => [
    href(locale, section),
    `/${locale}/${section}`,
  ]);
  const home = [href(locale), `/${locale}`];
  if (home.includes(pathname) || programme.some((base) => within(pathname, base))) return "programme";
  return null;
}
