import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { ActiveTabs } from "./ActiveTabs";
import { TabLinks, tabItems } from "./TabLinks";

/**
 * Bottom navigation from the design system. Only tabs with a real page: there is no
 * search page yet, so no "Haku" tab. Prerendered pages learn the current tab with
 * JavaScript; without it the bar still works, just with no tab marked.
 */
export function TabBar({ locale, t }: { locale: Locale; t: Dictionary }) {
  const items = tabItems(locale, t);
  return (
    <nav className="ai-tabbar" aria-label={t.nav.label}>
      <Suspense fallback={<TabLinks items={items} active={null} />}>
        <ActiveTabs locale={locale} items={items} />
      </Suspense>
    </nav>
  );
}
