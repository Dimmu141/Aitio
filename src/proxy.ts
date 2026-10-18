import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { resolvePublicPath } from "@/i18n/paths";
import { AUTH_COOKIE_PREFIX } from "@/lib/auth-config";
import { signInRedirect } from "@/lib/auth-gate";

/**
 * Map public, translated URLs onto the internal /[locale]/<finnish segment> routes, and
 * send signed-out visitors of personal pages to sign in with a real HTTP redirect.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const resolution = resolvePublicPath(pathname);
  const url = request.nextUrl.clone();

  if (resolution.kind === "redirect") {
    url.pathname = resolution.pathname;
    return NextResponse.redirect(url, 308);
  }

  const internal = resolution.kind === "rewrite" ? resolution.pathname : pathname;
  const hasSession = getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX }) !== null;
  const signIn = signInRedirect(internal, `${pathname}${search}`, hasSession);
  if (signIn) return NextResponse.redirect(new URL(signIn, request.url), 307);

  if (resolution.kind === "pass") return NextResponse.next();
  url.pathname = internal;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, API routes and anything with a file extension (icons, sitemap.xml, robots.txt).
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
