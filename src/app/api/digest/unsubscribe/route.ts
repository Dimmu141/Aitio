import { DEFAULT_LOCALE } from "@/i18n/config";
import { href } from "@/i18n/paths";
import { unsubscribe } from "@/lib/engagement/send-digests";

function params(request: Request): { userId: string; signature: string } {
  const url = new URL(request.url);
  return { userId: url.searchParams.get("u") ?? "", signature: url.searchParams.get("s") ?? "" };
}

/** RFC 8058 one-click: the mail client POSTs `List-Unsubscribe=One-Click` here. */
export async function POST(request: Request): Promise<Response> {
  const { userId, signature } = params(request);
  const done = await unsubscribe(userId, signature);
  return new Response(done ? "Unsubscribed" : "Invalid link", { status: done ? 200 : 400 });
}

/** A client that opens the header link instead: show the confirmation page, never act on GET. */
export function GET(request: Request): Response {
  const { userId, signature } = params(request);
  const query = new URLSearchParams({ u: userId, s: signature });
  return Response.redirect(new URL(`${href(DEFAULT_LOCALE, "peru-tilaus")}?${query.toString()}`, request.url), 303);
}
