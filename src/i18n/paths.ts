import { DEFAULT_LOCALE, isLocale, type Locale, SEGMENTS, type Section } from "./config";

const SECTIONS = Object.keys(SEGMENTS) as Section[];

/** Public URL for a page: `href("sv", "esitys", "nattland")` → `/sv/forestallning/nattland`. */
export function href(locale: Locale, section?: Section, slug?: string): string {
  const parts: string[] = locale === DEFAULT_LOCALE ? [] : [locale];
  if (section) parts.push(SEGMENTS[section][locale]);
  if (section && slug) parts.push(encodeURIComponent(slug));
  return `/${parts.join("/")}`;
}

export type Resolution =
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; pathname: string }
  | { kind: "pass" };

function sectionFor(locale: Locale, segment: string): Section | undefined {
  return SECTIONS.find((section) => SEGMENTS[section][locale] === segment);
}

/**
 * Map a public pathname to the internal `/[locale]/<finnish segment>/...` route.
 * Finnish has no prefix (`/esitys/x` → `/fi/esitys/x`), `/fi/...` redirects to the
 * unprefixed URL, and a Finnish segment under another locale (`/sv/esitys/x`)
 * redirects to the translated one, so every page has exactly one public URL.
 */
export function resolvePublicPath(pathname: string): Resolution {
  const [first = "", ...rest] = pathname.split("/").filter(Boolean);

  if (first === DEFAULT_LOCALE) {
    return { kind: "redirect", pathname: `/${rest.join("/")}` };
  }
  if (!isLocale(first)) {
    return { kind: "rewrite", pathname: `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}` };
  }

  const [segment, ...tail] = rest;
  if (segment === undefined) return { kind: "pass" };

  const section = sectionFor(first, segment);
  if (section) {
    const internal = [first, section, ...tail].join("/");
    return section === segment ? { kind: "pass" } : { kind: "rewrite", pathname: `/${internal}` };
  }
  const finnish = sectionFor(DEFAULT_LOCALE, segment);
  if (finnish) {
    return { kind: "redirect", pathname: `/${[first, SEGMENTS[finnish][first], ...tail].join("/")}` };
  }
  return { kind: "pass" };
}

/** The same page in every locale, for hreflang alternates and the language switcher. */
export function alternates(section?: Section, slug?: string): Record<Locale, string> {
  return {
    fi: href("fi", section, slug),
    sv: href("sv", section, slug),
    en: href("en", section, slug),
  };
}

/** The same page in another locale, from a public pathname: `/sv/forestallning/x` → `/show/x` for en. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const resolution = resolvePublicPath(pathname);
  const internal = resolution.kind === "pass" ? pathname : resolution.pathname;
  const [, segment, slug] = internal.split("/").filter(Boolean);
  const section = SECTIONS.find((candidate) => candidate === segment);
  return section ? href(target, section, slug === undefined ? undefined : decodeURIComponent(slug)) : href(target);
}
