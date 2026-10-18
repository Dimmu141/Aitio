"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/paths";
import { LocaleLinks } from "./LocaleLinks";

/** Same-page language links. SiteHeader renders front-page links as the fallback. */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const hrefs = {
    fi: switchLocalePath(pathname, "fi"),
    sv: switchLocalePath(pathname, "sv"),
    en: switchLocalePath(pathname, "en"),
  };
  return <LocaleLinks current={current} label={label} hrefs={hrefs} />;
}
