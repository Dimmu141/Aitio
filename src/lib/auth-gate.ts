import { isLocale } from "@/i18n/config";
import { href } from "@/i18n/paths";

const PERSONAL = new Set(["merkitse", "paivakirja", "asetukset", "ilmoita"]);

/**
 * Where to send a request for a personal page without a session cookie, or null to let
 * it through. Runs in proxy.ts because a redirect from the page itself comes too late:
 * the prerendered layout has already been sent with HTTP 200, so the redirect would
 * only work with JavaScript. The page still checks the session properly (stale cookies).
 */
export function signInRedirect(internalPath: string, publicPathWithQuery: string, hasSessionCookie: boolean): string | null {
  if (hasSessionCookie) return null;
  const [locale, section] = internalPath.split("/").filter(Boolean);
  if (!locale || !isLocale(locale) || !section || !PERSONAL.has(section)) return null;
  return `${href(locale, "kirjaudu")}?next=${encodeURIComponent(publicPathWithQuery)}`;
}
