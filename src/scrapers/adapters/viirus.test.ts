import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factLines, parseDetail, parseList } from "./viirus";

// Fixtures captured from the live site on 2026-10-18. Refresh with `pnpm fixtures:refresh`.
const fixture = (name: string) => readFileSync(`fixtures/viirus/${name}`, "utf8");

const list = parseList(fixture("repertoar.html"));
const ref = (slug: string) => {
  const found = list.find((item) => item.url.endsWith(`/${slug}/`));
  if (!found) throw new Error(`${slug} not in the repertoire fixture`);
  return found;
};
const detail = (slug: string) => parseDetail(fixture(`production-${slug}.html`), ref(slug));

describe("Viirus repertoire", () => {
  it("reads the Swedish repertoire from __NEXT_DATA__ with WordPress post ids", () => {
    expect(list).toHaveLength(7);
    expect(list[0]).toEqual({
      externalId: "28923",
      title: "Collage",
      url: "https://www.viirus.fi/sv/forestallningar/collage/",
      isVisiting: false,
    });
  });

  it("marks guest performances as visiting", () => {
    const visiting = list.filter((item) => item.isVisiting).map((item) => item.title);
    expect(visiting).toEqual(["Sandyrella", "Writing of Disaster", "The Escape Room", "Heavenly Father"]);
    expect(ref("1984").isVisiting).toBe(false);
  });
});

describe("Viirus production: Collage", () => {
  const collage = detail("collage");

  it("reads the English spoken language and Swedish and Finnish subtitles", () => {
    expect(collage.languages).toEqual(["en"]);
    expect(collage.subtitleLangs.sort()).toEqual(["fi", "sv"]);
  });

  it("reads facts from the bold-labelled lines", () => {
    expect(collage.title).toBe("Collage");
    expect(collage.premiereDate?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(collage.durationText).toBe("cirka 2 h 30 min inklusive paus");
    expect(collage.ticketUrl).toBe("https://fienta.com/s/collage-stage-of-things");
    expect(collage.runStart?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(collage.runEnd?.toISOString()).toBe("2026-12-04T00:00:00.000Z");
    expect(collage.performancesPartial).toBe(false);
  });

  it("reads the full calendar in Helsinki time, across the DST change", () => {
    expect(collage.performances).toHaveLength(24);
    expect(collage.performances[0]).toEqual({ startsAt: new Date("2026-10-10T15:30:00.000Z") });
    expect(collage.performances.at(-1)).toEqual({ startsAt: new Date("2026-12-04T16:30:00.000Z") });
    // The Saturday matinee.
    expect(collage.performances.map((p) => p.startsAt.toISOString())).toContain("2026-11-14T11:00:00.000Z");
  });

  it("keeps the production team and skips hosts, thanks and marketing", () => {
    expect(collage.credits).toContainEqual({ name: "Oskar Pöysti", roleText: "På scenen", roles: ["CAST"] });
    expect(collage.credits).toContainEqual({ name: "Fabian Nyberg", roleText: "Scenografi", roles: ["DESIGNER"] });
    expect(collage.credits).toContainEqual({ name: "Fabian Nyberg", roleText: "Design av rekvisita", roles: ["DESIGNER"] });
    expect(collage.credits).toContainEqual({ name: "Juho Ärmänen", roleText: "Bygge av scenografi", roles: ["OTHER"] });
    const names = collage.credits.map((credit) => credit.name);
    expect(names).not.toContain("Emma Presley"); // Aulavärdar
    expect(names).not.toContain("Essi Rossi"); // Konstnärlig ledare
    expect(names).not.toContain("Hanna Sundman"); // Ansvarig producent
    expect(names).not.toContain("Diana tandläkarstation"); // Tack
    expect(collage.credits.some((credit) => credit.roles.includes("WRITER"))).toBe(false);
  });
});

describe("Viirus production: Diptyk", () => {
  const diptyk = detail("diptyk");

  it("reads two spoken languages and three subtitle languages", () => {
    expect(diptyk.languages.sort()).toEqual(["fi", "sv"]);
    expect(diptyk.subtitleLangs.sort()).toEqual(["en", "fi", "sv"]);
  });

  it("drops calendar rows without a date and has no premiere without a full date", () => {
    expect(diptyk.performances).toHaveLength(22);
    expect(diptyk.performances[0].startsAt.toISOString()).toBe("2027-03-19T16:30:00.000Z");
    expect(diptyk.premiereDate).toBeUndefined();
  });

  it("reads nested bold markup and keeps translators apart from writers", () => {
    expect(diptyk.credits).toContainEqual({ name: "Minna Lund", roleText: "Regi och manus", roles: ["DIRECTOR", "WRITER"] });
    expect(diptyk.credits).toContainEqual({
      name: "David Sandqvist",
      roleText: "Manuskriptets översättning till svenska",
      roles: ["TRANSLATOR"],
    });
    expect(diptyk.credits).toContainEqual({ name: "Elina Snicker", roleText: "Dramaturg", roles: ["OTHER"] });
    expect(diptyk.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name)).toEqual([
      "Maria Ahlroth",
      "Oskar Pöysti",
      "Jessica Raita",
      "Lilli Sukula-Lindblom",
    ]);
  });
});

describe("Viirus production: Heavenly Father (guest)", () => {
  const heavenly = detail("heavenly-father");

  it("reads three spoken languages and no subtitles", () => {
    expect(heavenly.languages.sort()).toEqual(["ar", "en", "fi"]);
    expect(heavenly.subtitleLangs).toEqual([]);
    expect(heavenly.isVisiting).toBe(true);
  });

  it("splits combined roles and ignores the GUEST heading", () => {
    expect(heavenly.credits).toContainEqual({
      name: "Moe Mustafa",
      roleText: "Text, regi, på scenen",
      roles: ["DIRECTOR", "WRITER", "CAST"],
    });
    expect(heavenly.credits.map((credit) => credit.name)).not.toContain("HEAVENLY FATHER");
    expect(heavenly.credits).toHaveLength(5);
    expect(heavenly.performances.at(-1)?.startsAt.toISOString()).toBe("2027-01-16T12:00:00.000Z");
  });
});

describe("Viirus production: 1984 (on tour)", () => {
  const play = detail("1984");

  it("takes the language from the first sentence only", () => {
    // "svenska. Finskspråkigt manus finns att tillgå …" is Swedish, not Finnish.
    expect(play.languages).toEqual(["sv"]);
  });

  it("credits the novel's author and drops the agency after the slash", () => {
    expect(play.credits).toContainEqual({ name: "George Orwell", roleText: "Baserad på", roles: ["WRITER"] });
    expect(play.credits).toContainEqual({
      name: "Kaisa Lundán",
      roleText: "Översättning av manuskriptet till svenska",
      roles: ["TRANSLATOR"],
    });
    expect(play.credits.map((credit) => credit.name)).not.toContain("Nordic Drama Corner Oy");
  });
});

describe("Viirus fact lines", () => {
  it("splits labels from values with the colon inside or outside the bold text", () => {
    const lines = factLines(
      '<p><strong>Språk:</strong> Engelska<br /><strong>Längd: </strong>1 h<br /><strong>Ålder</strong>: 16</p><p>Prosa <strong>fet</strong></p>',
    );
    expect(lines).toEqual([
      { label: "Språk", value: "Engelska" },
      { label: "Längd", value: "1 h" },
      { label: "Ålder", value: "16" },
    ]);
  });
});
