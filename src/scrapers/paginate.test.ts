import { describe, expect, it } from "vitest";
import { collectPages } from "./paginate";
import type { RawProduction } from "./types";

const production = (id: string): RawProduction => ({ externalId: id, title: id, url: `https://x.fi/${id}`, isVisiting: false });

/** Fake site: each "page" is a comma list of ids plus an optional next url after a "|". */
function site(pages: Record<string, string>) {
  const requested: string[] = [];
  return {
    requested,
    fetchPage: async (url: string) => {
      requested.push(url);
      return pages[url];
    },
    parse: (html: string) => html.split("|")[0].split(",").filter(Boolean).map(production),
    next: (html: string) => html.split("|")[1] || null,
  };
}

describe("collectPages", () => {
  it("follows next links until the last page", async () => {
    const fake = site({ p1: "a,b|p2", p2: "c|p3", p3: "d" });
    const result = await collectPages("p1", fake.fetchPage, fake.parse, fake.next);
    expect(result.map((item) => item.externalId)).toEqual(["a", "b", "c", "d"]);
    expect(fake.requested).toEqual(["p1", "p2", "p3"]);
  });

  it("stops when a page repeats what we already have", async () => {
    const fake = site({ p1: "a,b|p2", p2: "a,b|p3", p3: "a,b|p4" });
    await collectPages("p1", fake.fetchPage, fake.parse, fake.next);
    expect(fake.requested).toEqual(["p1", "p2"]);
  });

  it("respects the page limit", async () => {
    const pages = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${i}`, `x${i}|p${i + 1}`]));
    const fake = site(pages);
    await collectPages("p0", fake.fetchPage, fake.parse, fake.next, 3);
    expect(fake.requested).toHaveLength(3);
  });
});
