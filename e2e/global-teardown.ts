import "dotenv/config";
import { Client } from "pg";

/**
 * The tests sign up throwaway users (…@example.fi) in whatever database the server uses;
 * remove them afterwards so dev data doesn't fill up with test reviews. The foreign keys
 * cascade to entries, reports and sessions. Plain pg because Playwright loads this file
 * as CommonJS and the generated Prisma client is ESM-only. Cached production pages catch
 * up within the hour (or on the next build).
 */
export default async function globalTeardown(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query(`DELETE FROM "User" WHERE email LIKE '%@example.fi'`);
    await client.query(`DELETE FROM "RateLimit" WHERE key LIKE '%@example.fi%'`);
    console.log(`Removed ${rowCount ?? 0} e2e users`);
  } finally {
    await client.end();
  }
}
