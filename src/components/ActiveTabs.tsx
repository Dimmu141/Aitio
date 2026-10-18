"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { activeTab } from "./tabs";
import { type TabItem, TabLinks, type TabVariant } from "./TabLinks";

export function ActiveTabs({ locale, items, variant }: { locale: Locale; items: TabItem[]; variant: TabVariant }) {
  return <TabLinks items={items} active={activeTab(usePathname(), locale)} variant={variant} />;
}
