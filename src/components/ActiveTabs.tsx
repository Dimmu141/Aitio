"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { activeTab } from "./tabs";
import { type TabItem, TabLinks } from "./TabLinks";

export function ActiveTabs({ locale, items }: { locale: Locale; items: TabItem[] }) {
  return <TabLinks items={items} active={activeTab(usePathname(), locale)} />;
}
