/**
 * Running time from the theatre's own free text ("n. 2 h 30 min, sis. väliajan",
 * "1 t, ei väliaikaa", "ca 90 min, ingen paus"). Every page shows this compact,
 * translated form, never the source text, so "Is there an interval?" is answered
 * before anyone opens the show and no Finnish leaks into the Swedish or English UI.
 */
export interface Duration {
  minutes: number | null;
  /** 0 = no interval, n = that many, null = the text doesn't say. */
  intervals: number | null;
  /** The theatre says the time is an estimate until the premiere week. */
  estimate: boolean;
}

const HOURS = /(\d+(?:[,.]\d+)?)\s*(?:tuntia|tunti|timmar|timme|hours?|h|t)(?![a-zåäö])/i;
const MINUTES = /(\d+)\s*(?:minuuttia|minuter|min)/i;
const NO_INTERVAL = /ei väliaikaa|ingen paus|utan paus|inga pauser|no interval|without (?:an )?interval/i;
const SEVERAL = /(\d|kaksi|två|two)\s*(?:väliaika|pauser|intervals)/i;
const WORD_NUMBERS: Record<string, number> = { kaksi: 2, två: 2, two: 2 };
const ONE_INTERVAL = /väliaj|väliaik|paus|interval/i;
const ESTIMATE = /arvioitu|kestoarvio|tarkentuu|uppdateras|bekräftas|preliminär|estimated/i;

export function parseDuration(text: string | null): Duration | null {
  if (!text) return null;
  // The total comes first; minutes in brackets or after a comma are the interval's.
  const head = text.split(/,(?!\d)|\(/)[0];
  const hours = head.match(HOURS);
  const minutes = head.match(MINUTES);
  const total =
    hours || minutes
      ? Math.round(Number((hours?.[1] ?? "0").replace(",", ".")) * 60) + Number(minutes?.[1] ?? 0)
      : null;
  // "Noin 2 h (sis. väliaika), arkiaamunäytökset noin 1 h (ei väliaikaa)": the first one counts.
  const main = text.split(/\),/)[0];
  const several = main.match(SEVERAL);
  const intervals = NO_INTERVAL.test(main)
    ? 0
    : several
      ? (WORD_NUMBERS[several[1].toLowerCase()] ?? Number(several[1]))
      : ONE_INTERVAL.test(main)
        ? 1
        : null;
  if (total === null && intervals === null) return null;
  return { minutes: total || null, intervals, estimate: ESTIMATE.test(text) };
}

interface DurationLabels {
  durationShort: (minutes: number) => string;
  intervals: (n: number) => string;
  approximately: string;
}

/** "2 t 45 min, väliaika"; with `estimate`, "noin 2 t 45 min, väliaika" when the theatre says so. */
export function durationLabel(duration: Duration | null, labels: DurationLabels, estimate = false): string | null {
  if (!duration?.minutes) return null;
  const length = labels.durationShort(duration.minutes);
  const shown = estimate && duration.estimate ? `${labels.approximately} ${length}` : length;
  return duration.intervals === null ? shown : `${shown}, ${labels.intervals(duration.intervals)}`;
}
