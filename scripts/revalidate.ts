/**
 * Clear cached pages on the live site from a process outside Next.js, through
 * /api/revalidate. Needs SITE_URL and REVALIDATE_SECRET; returns null without them.
 */
export async function revalidateRemote(tags: string[]): Promise<boolean | null> {
  const site = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) return null;
  const response = await fetch(new URL("/api/revalidate", site), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tags, immediate: true }),
  });
  if (!response.ok) console.error(`Cache clear failed: HTTP ${response.status}`);
  return response.ok;
}
