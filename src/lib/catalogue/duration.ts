/**
 * Running time from the theatre's own free text ("n. 2 h 30 min, sis. väliajan",
 * "1 t, ei väliaikaa", "ca 90 min, ingen paus"). The page keeps the original text;
 * cards show this compact, translated form, so "Is there an interval?" is answered
 * before anyone opens the show.
 */
export interface Duration {
  minutes: number | null;
  /** 0 = no interval, n = that many, null = the text doesn't say. */
  intervals: number | null;
}

const HOURS = /(\d+(?:[,.]\d+)?)\s*(?:tuntia|tunti|timmar|timme|hours?|h|t)(?![a-zåäö])/i;
const MINUTES = /(\d+)\s*(?:minuuttia|minuter|min)/i;
const NO_INTERVAL = /ei väliaikaa|ingen paus|utan paus|inga pauser|no interval|without (?:an )?interval/i;
const SEVERAL = /(\d|kaksi|två|two)\s*(?:väliaika|pauser|intervals)/i;
const WORD_NUMBERS: Record<string, number> = { kaksi: 2, två: 2, two: 2 };
const ONE_INTERVAL = /väliaj|väliaik|paus|interval/i;

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
  return { minutes: total || null, intervals };
}
