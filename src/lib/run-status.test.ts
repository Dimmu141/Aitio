import { describe, expect, it } from "vitest";
import { runStatus } from "./run-status";

const now = new Date("2026-10-18T09:00:00Z");
// Nattland at Svenska Teatern, from the fixture.
const nattland = {
  premiereDate: new Date("2026-09-10T00:00:00Z"),
  runStart: null,
  runEnd: new Date("2026-11-14T00:00:00Z"),
  performances: [new Date("2026-10-23T16:00:00Z"), new Date("2026-11-14T17:00:00Z")],
};

describe("runStatus", () => {
  it("reports progress and remaining performances for a running show", () => {
    const status = runStatus(nattland, now);
    expect(status.phase).toBe("running");
    expect(status.progress).toBe(59);
    expect(status.remaining).toBe(2);
  });

  it("flags the last 14 days as closing", () => {
    expect(runStatus(nattland, new Date("2026-11-05T09:00:00Z")).phase).toBe("closing");
  });

  it("keeps the final day open until it is over", () => {
    expect(runStatus(nattland, new Date("2026-11-14T15:00:00Z")).phase).toBe("closing");
  });

  it("reports an ended run", () => {
    const status = runStatus(nattland, new Date("2026-12-01T09:00:00Z"));
    expect(status.phase).toBe("ended");
    expect(status.progress).toBe(100);
  });

  it("reports a run that has not opened yet", () => {
    expect(runStatus({ ...nattland, premiereDate: new Date("2026-10-25T00:00:00Z") }, now).phase).toBe("upcoming");
  });

  it("falls back to performance dates when the run dates are missing", () => {
    const status = runStatus({ ...nattland, premiereDate: null, runEnd: null }, now);
    expect(status.opensAt).toEqual(nattland.performances[0]);
    expect(status.endsAt).toEqual(nattland.performances[1]);
  });

  it("ends a run stored as the final show's start time at the end of that day", () => {
    // Kansallisteatteri: runEnd is the last performance, la 19.12. klo 18.30.
    const run = { premiereDate: null, runStart: null, runEnd: new Date("2026-12-19T16:30:00Z"), performances: [] };
    expect(runStatus(run, new Date("2026-12-19T21:00:00Z")).phase).toBe("closing");
    expect(runStatus(run, new Date("2026-12-19T22:30:00Z")).phase).toBe("ended");
    expect(runStatus(run, new Date("2026-12-05T22:30:00Z")).phase).toBe("closing");
    expect(runStatus(run, new Date("2026-12-05T21:30:00Z")).phase).toBe("running");
  });
});
