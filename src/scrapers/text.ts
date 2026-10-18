/** Collapse all whitespace (including nbsp) to single spaces and trim. */
export function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/[\s ]+/g, " ").trim();
}

/** URL-safe slug that keeps Finnish and Swedish letters readable (ä → a, å → a, ö → o). */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ja ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Parse Finnish-style dates "10.9.2026" into a UTC midnight Date. */
export function parseFinnishDate(value: string): Date | undefined {
  const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(value);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

const HELSINKI = "Europe/Helsinki";

/**
 * Convert a wall-clock time in Helsinki to a UTC Date, handling DST.
 * date: "YYYY-MM-DD", time: "HH:MM".
 */
export function helsinkiToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMinutes = tzOffsetMinutes(new Date(guess));
  const first = new Date(guess - offsetMinutes * 60_000);
  // Re-check around DST switches, where the offset at the result differs from the guess.
  const correctedOffset = tzOffsetMinutes(first);
  return correctedOffset === offsetMinutes
    ? first
    : new Date(guess - correctedOffset * 60_000);
}

function tzOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HELSINKI,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Map language names in Finnish or Swedish to ISO codes. */
export function languageCodes(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  const table: Array<[RegExp, string]> = [
    [/suom|finsk/, "fi"],
    [/ruots|svensk/, "sv"],
    [/engl|engel/, "en"],
    [/ven[äa]j|rysk/, "ru"],
    [/ukrain/, "uk"],
    [/viittomakiel|teckenspr/, "sign"],
  ];
  for (const [pattern, code] of table) {
    if (pattern.test(lower)) found.add(code);
  }
  return [...found];
}

/** "Mawlawi Rahem (vier.)" → "Mawlawi Rahem": guest markers aren't part of the name. */
export function stripGuestMarker(name: string): string {
  return cleanText(name.replace(/\((?:vier|gäst|guest)\.?\)/gi, ""));
}

const WEEKDAY_ADVERBS: Array<[RegExp, number]> = [
  [/sunnuntaisin|söndagar/, 0],
  [/maanantaisin|måndagar/, 1],
  [/tiistaisin|tisdagar/, 2],
  [/keskiviikkoisin|onsdagar/, 3],
  [/torstaisin|torsdagar/, 4],
  [/perjantaisin|fredagar/, 5],
  [/lauantaisin|lördagar/, 6],
];

/** "keskiviikkoisin ja perjantaisin" → [3, 5] (0 = Sunday), in Finnish or Swedish. */
export function weekdaysIn(text: string): number[] {
  const lower = text.toLowerCase();
  return WEEKDAY_ADVERBS.filter(([pattern]) => pattern.test(lower)).map(([, day]) => day);
}

/** The weekday of an instant in Helsinki (0 = Sunday). */
export function helsinkiWeekday(instant: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(instant);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
