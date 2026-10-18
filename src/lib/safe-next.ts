/**
 * Only same-site paths survive as a redirect target: "/paivakirja" yes,
 * "//evil.example", "https://evil.example" or "/\\evil.example" no.
 */
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://aitio.invalid");
    return url.origin === "https://aitio.invalid" ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
