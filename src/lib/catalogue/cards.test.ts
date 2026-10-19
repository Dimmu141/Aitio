import { describe, expect, it } from "vitest";
import { toCard } from "./cards";

const asOf = new Date("2026-10-20T10:00:00Z");
const seen = new Date("2026-10-18T03:00:00Z");
const day = (n: number) => new Date(asOf.getTime() + n * 24 * 60 * 60 * 1000);

function source(performances: Array<{ startsAt: Date; subtitleLangs: string[] }>, subtitleLangs: string[] = []) {
  return {
    slug: "lady-t",
    title: "Lady T",
    type: "PLAY" as const,
    typeOverride: null,
    languages: ["fi"],
    subtitleLangs,
    durationText: "2 t 30 min, sis. väliajan" as string | null,
    lastSeenAt: seen,
    delistedAt: null as Date | null,
    premiereDate: null,
    runStart: null as Date | null,
    runEnd: null as Date | null,
    theatre: { slug: "kansallisteatteri", name: "Kansallisteatteri", city: "Helsinki" },
    stage: null,
    performances: performances.map((performance) => ({ ...performance, lastSeenAt: seen })),
  };
}

describe("toCard subtitles", () => {
  it("counts a subtitled performance within the next two weeks", () => {
    const card = toCard(source([{ startsAt: day(1), subtitleLangs: [] }, { startsAt: day(3), subtitleLangs: ["fi", "en"] }]), asOf);
    expect(card.subtitleLangs).toEqual(["fi", "en"]);
  });

  it("ignores subtitles only after the window or in the past", () => {
    const card = toCard(
      source([
        { startsAt: day(-2), subtitleLangs: ["en"] },
        { startsAt: day(1), subtitleLangs: [] },
        { startsAt: day(20), subtitleLangs: ["en"] },
      ]),
      asOf,
    );
    expect(card.subtitleLangs).toEqual([]);
  });

  it("keeps production-wide subtitles", () => {
    expect(toCard(source([{ startsAt: day(1), subtitleLangs: [] }], ["sv"]), asOf).subtitleLangs).toEqual(["sv"]);
  });
});

describe("toCard for a delisted production", () => {
  it("has no upcoming performances, whatever is stored", () => {
    const card = toCard({ ...source([{ startsAt: day(2), subtitleLangs: [] }]), delistedAt: seen }, asOf);
    expect(card).toMatchObject({ next: null, onSoon: false, subtitleLangs: [] });
  });

  it("keeps the performances within the window and reads the running time", () => {
    const card = toCard(source([{ startsAt: day(1), subtitleLangs: [] }, { startsAt: day(20), subtitleLangs: [] }]), asOf);
    expect(card.soon).toEqual([day(1)]);
    expect(card.duration).toEqual({ minutes: 150, intervals: 1, estimate: false });
  });
});
