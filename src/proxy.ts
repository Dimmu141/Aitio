import { type NextRequest, NextResponse } from "next/server";
import { resolvePublicPath } from "@/i18n/paths";

/** Map public, translated URLs onto the internal /[locale]/<finnish segment> routes. */
export function proxy(request: NextRequest): NextResponse {
  const resolution = resolvePublicPath(request.nextUrl.pathname);
  if (resolution.kind === "pass") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = resolution.pathname;
  return resolution.kind === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, API routes and anything with a file extension (icons, sitemap.xml, robots.txt).
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
