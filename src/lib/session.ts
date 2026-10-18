import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { auth } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

/** The signed-in user, or null. Reads the request, so only call it from dynamic pages and actions. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export function signInHref(locale: Locale, next: string): string {
  return `${href(locale, "kirjaudu")}?next=${encodeURIComponent(next)}`;
}

/** The signed-in user, or a redirect to sign in that comes back to `next` afterwards. */
export async function requireUser(locale: Locale, next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInHref(locale, next));
  return user;
}
