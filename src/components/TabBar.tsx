import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { ActiveTabs } from "./ActiveTabs";
import { TabLinks, type TabVariant, tabItems } from "./TabLinks";

/**
 * Main navigation from the design system: a bottom tab bar on phones, the same links
 * in the top bar from 48rem up. Only tabs with a real page: there is no search page
 * yet, so no "Haku" tab. Prerendered pages learn the current tab with JavaScript;
 * without it the links still work, just with no tab marked.
 */
export function TabBar({ locale, t, variant }: { locale: Locale; t: Dictionary; variant: TabVariant }) {
  const items = tabItems(locale, t);
  return (
    <nav className={variant === "bar" ? "ai-tabbar" : "ai-topnav"} aria-label={t.nav.label}>
      <Suspense fallback={<TabLinks items={items} active={null} variant={variant} />}>
        <ActiveTabs locale={locale} items={items} variant={variant} />
      </Suspense>
    </nav>
  );
}
