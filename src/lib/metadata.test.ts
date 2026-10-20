import { describe, expect, it } from "vitest";
import { PERSON_INDEX_LOCALE } from "@/lib/catalogue/select";
import { pageMetadata } from "./metadata";

// Third review (20 Oct 2026): /sv/person/* and /en/person/* were indexable duplicates.
describe("pageMetadata for person pages", () => {
  const person = (locale: "fi" | "sv" | "en", noindex = false) =>
    pageMetadata({
      locale,
      section: "henkilo",
      slug: "maria-lundstrom",
      title: "Maria Lundström",
      description: "x",
      noindex: noindex || locale !== PERSON_INDEX_LOCALE,
      indexedLocales: [PERSON_INDEX_LOCALE],
    });

  it("indexes the Finnish page only", () => {
    expect(person("fi").robots).toBeUndefined();
    expect(person("sv").robots).toEqual({ index: false, follow: true });
    expect(person("en").robots).toEqual({ index: false, follow: true });
  });

  it("offers only the Finnish page as a language alternate", () => {
    expect(Object.keys(person("sv").alternates?.languages ?? {})).toEqual(["fi", "x-default"]);
  });

  it("leaves other pages' alternates alone", () => {
    const show = pageMetadata({ locale: "sv", section: "esitys", slug: "x", title: "X", description: "x" });
    expect(Object.keys(show.alternates?.languages ?? {}).sort()).toEqual(["en", "fi", "sv", "x-default"]);
  });
});
