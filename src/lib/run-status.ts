const DAY_MS = 24 * 60 * 60 * 1000;
export const CLOSING_SOON_DAYS = 14;

export type RunPhase = "upcoming" | "running" | "closing" | "ended" | "unknown";

export type RunStatus = {
  phase: RunPhase;
  /** 0–100, how much of the run from opening to the last performance has passed. */
  progress: number | null;
  opensAt: Date | null;
  endsAt: Date | null;
  remaining: number;
};

export type RunInput = {
  premiereDate: Date | null;
  runStart: Date | null;
  runEnd: Date | null;
  performances: Date[];
};

function bounds(input: RunInput): { opensAt: Date | null; endsAt: Date | null } {
  const sorted = [...input.performances].sort((a, b) => a.getTime() - b.getTime());
  return {
    opensAt: input.premiereDate ?? input.runStart ?? sorted[0] ?? null,
    endsAt: input.runEnd ?? sorted.at(-1) ?? null,
  };
}

function phaseOf(opensAt: Date | null, endsAt: Date | null, remaining: number, now: Date): RunPhase {
  if (!endsAt) return remaining > 0 ? "running" : "unknown";
  // runEnd is stored as the date at UTC midnight: the run lasts the whole day.
  const endOfRun = endsAt.getTime() + DAY_MS;
  if (endOfRun <= now.getTime() && remaining === 0) return "ended";
  if (opensAt && opensAt.getTime() > now.getTime()) return "upcoming";
  return endOfRun - now.getTime() <= CLOSING_SOON_DAYS * DAY_MS ? "closing" : "running";
}

export function runStatus(input: RunInput, now: Date): RunStatus {
  const { opensAt, endsAt } = bounds(input);
  const remaining = input.performances.filter((date) => date.getTime() >= now.getTime()).length;
  const phase = phaseOf(opensAt, endsAt, remaining, now);
  let progress: number | null = null;
  if (opensAt && endsAt && endsAt.getTime() > opensAt.getTime()) {
    const share = (now.getTime() - opensAt.getTime()) / (endsAt.getTime() - opensAt.getTime());
    progress = Math.round(Math.min(1, Math.max(0, share)) * 100);
  }
  return { phase, progress, opensAt, endsAt, remaining };
}
