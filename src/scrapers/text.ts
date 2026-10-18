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
    [/espanj|spansk|spanish/, "es"],
    [/arabi/, "ar"],
    [/latvi|lettisk/, "lv"],
    [/viro|eesti|estnisk/, "et"],
    [/ranska|fransk|french/, "fr"],
    [/saksa|tysk|german/, "de"],
    [/viittomakiel|teckenspr/, "sign"],
    // ISO 639-2 "no linguistic content": wordless performances.
    [/sanaton|ordlös|wordless/, "zxx"],
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

const WEEKDAY_ABBREVIATIONS: Record<string, number> = { su: 0, ma: 1, ti: 2, ke: 3, to: 4, pe: 5, la: 6 };

/**
 * The year of "la 14.11." with no year printed: the year near `near` (within one year
 * either way) whose 14 November is a Saturday. The weekday makes this exact rather than
 * a guess; returns null when no candidate year matches.
 */
export function yearFromWeekday(day: number, month: number, weekday: string, near: Date): number | null {
  const wanted = WEEKDAY_ABBREVIATIONS[weekday.toLowerCase().slice(0, 2)];
  if (wanted === undefined) return null;
  const base = near.getUTCFullYear();
  const candidates = [base, base + 1, base - 1].filter(
    (year) => new Date(Date.UTC(year, month - 1, day)).getUTCDay() === wanted,
  );
  return candidates[0] ?? null;
}

const NAME_PARTICLES = new Set(["af", "av", "da", "de", "del", "della", "der", "di", "do", "dos", "du", "la", "le", "van", "von", "y", "zu"]);

/**
 * A credit candidate as a person's name, or null when it is a phrase instead.
 * "Anacarsis Ramos / Pornotráfico" → "Anacarsis Ramos" (the company after the slash
 * goes), and "Anacarsis Ramos Josefina Orlainetan arkistojen pohjalta" ("based on her
 * archives") is not a name: real names have no ordinary lowercase words in them.
 * A single lowercase word passes, because some artists use one ("magu").
 */
export function personName(raw: string): string | null {
  const name = cleanText(raw.split(/\s+\/\s+/)[0]);
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return null;
  // Collective labels, not people.
  if (/^(työryhmä|arbetsgruppen?|ensemble|team)$/i.test(name)) return null;
  const prose = words.length > 1 && words.some((word) => /^\p{Ll}/u.test(word) && !NAME_PARTICLES.has(word));
  return prose ? null : name;
}
