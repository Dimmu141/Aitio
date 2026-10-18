import { describe, expect, it } from "vitest";
import type { ProductionCard } from "@/lib/catalogue/types";
import { composeDigest, digestItems } from "./digest";
import { isValidUnsubscribe, unsubscribeSignature } from "./unsubscribe";

const asOf = new Date("2026-10-15T05:00:00Z");

function card(slug: string, last: string | null, closingSoon = true): ProductionCard {
  return {
    slug,
    title: slug.toUpperCase(),
    theatre: { slug: "hkt", name: "HKT", city: "Helsinki" },
    stage: null,
    type: "PLAY",
    languages: ["fi"],
    subtitleLangs: [],
    next: last ? new Date(last) : null,
    last: last ? new Date(last) : null,
    onSoon: true,
    closingSoon,
    year: null,
  };
}

describe("digestItems", () => {
  it("keeps closing productions the user hasn't seen, closing first", () => {
    const cards = [card("b", "2026-10-25T16:00:00Z"), card("a", "2026-10-20T16:00:00Z"), card("seen", "2026-10-18T16:00:00Z"), card("later", "2026-12-01T16:00:00Z", false)];
    expect(digestItems(cards, new Set(["seen"])).map((item) => item.slug)).toEqual(["a", "b"]);
  });
});

describe("composeDigest", () => {
  const links = { absolute: (path: string) => `https://aitio.fi${path}`, unsubscribeUrl: "https://aitio.fi/peru-tilaus?u=1&s=x" };

  it("writes a plain-text email in the user's language with links and a way out", () => {
    const email = composeDigest("sv", [card("julia", "2026-10-20T16:00:00Z")], links, asOf);
    expect(email.subject).toBe("1 föreställning slutar snart");
    expect(email.text).toContain("JULIA, HKT");
    expect(email.text).toContain("https://aitio.fi/sv/forestallning/julia");
    expect(email.text).toContain("Sista föreställningen");
    expect(email.text).toContain("https://aitio.fi/sv/installningar");
    expect(email.text).toContain(links.unsubscribeUrl);
  });

  it("shows Helsinki wall-clock times", () => {
    const email = composeDigest("fi", [card("julia", "2026-10-20T16:00:00Z"), card("x", "2026-10-21T16:00:00Z")], links, asOf);
    expect(email.subject).toBe("2 esitystä päättyy pian");
    expect(email.text).toMatch(/Viimeinen esitys ti 20\.10\. klo 19\.00/);
  });
});

describe("unsubscribe signature", () => {
  it("accepts its own signature and nothing else", () => {
    const signature = unsubscribeSignature("user-1", "secret");
    expect(isValidUnsubscribe("user-1", signature, "secret")).toBe(true);
    expect(isValidUnsubscribe("user-2", signature, "secret")).toBe(false);
    expect(isValidUnsubscribe("user-1", signature, "other-secret")).toBe(false);
    expect(isValidUnsubscribe("user-1", "", "secret")).toBe(false);
  });
});
