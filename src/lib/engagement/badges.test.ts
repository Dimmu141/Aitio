import { describe, expect, it } from "vitest";
import { type BadgeId, badges } from "./badges";
import { entry } from "./test-facts";

const TODAY = "2026-10-18";

function badge(entries: ReturnType<typeof entry>[], id: BadgeId, theatres = 6) {
  const found = badges(entries, theatres, TODAY).find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}

const days = (n: number, start = 1) => Array.from({ length: n }, (_, i) => `2026-0${1 + Math.floor((start + i - 1) / 28)}-${String(((start + i - 1) % 28) + 1).padStart(2, "0")}`);

describe("badges", () => {
  it("has nothing earned for an empty diary, with progress for counting badges", () => {
    const all = badges([], 6, TODAY);
    expect(all.every((candidate) => candidate.earnedOn === null)).toBe(true);
    expect(all.find((candidate) => candidate.id === "regular")?.progress).toEqual({ current: 0, target: 10 });
  });

  it("dates a badge to the entry that earned it", () => {
    const entries = days(10).map((day, i) => entry(day, { production: { slug: `p${i}` } }));
    expect(badge(entries, "first").earnedOn).toBe("2026-01-01");
    expect(badge(entries, "regular").earnedOn).toBe("2026-01-10");
    expect(badge(entries.slice(0, 7), "regular")).toMatchObject({ earnedOn: null, progress: { current: 7, target: 10 } });
  });

  it("counts distinct theatres against the number Aitio covers", () => {
    const at = (slug: string, day: string) => entry(day, { production: { slug, theatre: { slug, name: slug } } });
    const entries = [at("a", "2026-01-01"), at("a", "2026-01-02"), at("b", "2026-01-03"), at("c", "2026-01-04")];
    expect(badge(entries, "wanderer").earnedOn).toBe("2026-01-04");
    expect(badge(entries, "wholeCity", 6).progress).toEqual({ current: 3, target: 6 });
    expect(badge(entries, "wholeCity", 3).earnedOn).toBe("2026-01-04");
  });

  it("knows premieres and final days, but only once the run is over", () => {
    expect(badge([entry("2026-02-01", { production: { premiere: "2026-02-01" } })], "premiere").earnedOn).toBe("2026-02-01");
    expect(badge([entry("2026-02-01", { production: { finalPerformance: "2026-02-01" } })], "lastChance").earnedOn).toBe("2026-02-01");
    // Seen today on what is so far the last listed date: more dates may still come.
    expect(badge([entry(TODAY, { production: { finalPerformance: TODAY } })], "lastChance").earnedOn).toBeNull();
  });

  it("needs both Finnish and Swedish for bilingual", () => {
    const fi = entry("2026-01-01", { production: { slug: "a", languages: ["fi"] } });
    const sv = entry("2026-01-02", { production: { slug: "b", languages: ["sv"] } });
    const en = entry("2026-01-03", { production: { slug: "c", languages: ["en"] } });
    expect(badge([fi, en], "bilingual").earnedOn).toBeNull();
    expect(badge([fi, en, sv], "bilingual").earnedOn).toBe("2026-01-02");
  });

  it("counts reviews, genres, repeats and busy months", () => {
    const reviews = days(10).map((day, i) => entry(day, { hasReview: i % 2 === 0, production: { slug: `p${i}` } }));
    expect(badge(reviews, "critic").progress).toEqual({ current: 5, target: 10 });

    const types = (["PLAY", "MUSICAL", "OPERA", "DANCE"] as const).map((type, i) => entry(`2026-0${i + 1}-01`, { production: { slug: type, type } }));
    expect(badge(types, "versatile").earnedOn).toBe("2026-04-01");

    expect(badge([entry("2026-01-01"), entry("2026-05-01")], "again").earnedOn).toBe("2026-05-01");
    expect(badge([entry("2026-01-01", { isRewatch: true })], "again").earnedOn).toBe("2026-01-01");

    const spread = ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-02", "2026-02-20", "2026-02-27"].map((day, i) =>
      entry(day, { production: { slug: `m${i}` } }),
    );
    expect(badge(spread, "busyMonth").earnedOn).toBe("2026-02-27");
    expect(badge(spread.slice(0, 5), "busyMonth").progress).toEqual({ current: 3, target: 4 });
  });

  it("ignores entry order and future dates", () => {
    const entries = [entry("2026-03-01", { production: { slug: "b" } }), entry("2026-01-01", { production: { slug: "a" } }), entry("2027-01-01")];
    expect(badge(entries, "first").earnedOn).toBe("2026-01-01");
    expect(badge(entries, "regular").progress?.current).toBe(2);
  });
});
