import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { exportData } from "@/lib/diary/service";

/** GDPR download: everything we hold about the signed-in user, as JSON. */
export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const data = await exportData(session.user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aitio-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
