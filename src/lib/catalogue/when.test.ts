import { describe, expect, it } from "vitest";
import { firstOn, whenDates } from "./when";

// Helsinki is UTC+3 until 25 Oct 2026.
const at = (iso: string) => new Date(iso);

describe("whenDates", () => {
  it("names today and tomorrow by the Helsinki calendar, not UTC", () => {
    const lateSunday = at("2026-10-18T22:30:00Z"); // Monday 01:30 in Helsinki
    expect([...whenDates("today", lateSunday)]).toEqual(["2026-10-19"]);
    expect([...whenDates("tomorrow", lateSunday)]).toEqual(["2026-10-20"]);
  });

  it("covers seven days from today", () => {
    expect([...whenDates("week", at("2026-10-18T09:00:00Z"))]).toEqual([
      "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ]);
  });

  it.each([
    ["2026-10-19T09:00:00Z", ["2026-10-23", "2026-10-24", "2026-10-25"]], // Monday: the coming weekend
    ["2026-10-23T09:00:00Z", ["2026-10-23", "2026-10-24", "2026-10-25"]], // Friday
    ["2026-10-24T09:00:00Z", ["2026-10-24", "2026-10-25"]], // Saturday: what's left
    ["2026-10-25T09:00:00Z", ["2026-10-25"]], // Sunday
  ])("weekend seen on %s", (asOf, dates) => {
    expect([...whenDates("weekend", at(asOf))]).toEqual(dates);
  });
});

describe("firstOn", () => {
  it("picks the first performance on a covered date", () => {
    const performances = [at("2026-10-19T16:00:00Z"), at("2026-10-23T16:00:00Z"), at("2026-10-24T11:00:00Z")];
    expect(firstOn(performances, new Set(["2026-10-23", "2026-10-24"]))).toEqual(at("2026-10-23T16:00:00Z"));
    expect(firstOn(performances, new Set(["2026-10-21"]))).toBeNull();
  });
});
