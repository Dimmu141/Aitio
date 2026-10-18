import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { type Tab, TABS } from "./tabs";

const ICONS: Record<Tab, ReactNode> = {
  programme: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  diary: (
    <>
      <path d="M3 7.5V5h18v2.5a2.5 2.5 0 0 0 0 5V19H3v-6.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M15 5v14" strokeDasharray="2 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 20.5c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5" />
    </>
  ),
};

export interface TabItem {
  tab: Tab;
  label: string;
  href: string;
}

export function tabItems(locale: Locale, t: Dictionary): TabItem[] {
  const labels: Record<Tab, string> = { programme: t.home.title, search: t.nav.search, diary: t.nav.diary, settings: t.settings.title };
  const targets: Record<Tab, string> = {
    programme: href(locale),
    search: href(locale, "haku"),
    diary: href(locale, "paivakirja"),
    settings: href(locale, "asetukset"),
  };
  return TABS.map((tab) => ({ tab, label: labels[tab], href: targets[tab] }));
}

export type TabVariant = "bar" | "top";

/**
 * Plain strings only: the client version gets these props across the server boundary.
 * "bar" is the phone's bottom tab bar, "top" the same links in the desktop top bar.
 */
export function TabLinks({ items, active, variant }: { items: TabItem[]; active: Tab | null; variant: TabVariant }) {
  return (
    <ul className={variant === "bar" ? "ai-tabbar__list" : "ai-topnav__list"}>
      {items.map((item) => (
        <li key={item.tab} className="grid">
          <Link
            href={item.href}
            className={variant === "bar" ? "ai-tab" : "ai-topnav__link"}
            aria-current={item.tab === active ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[item.tab]}
            </svg>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
