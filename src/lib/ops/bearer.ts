import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <secret>`, compared in constant time; false when no secret is configured. */
export function hasBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
