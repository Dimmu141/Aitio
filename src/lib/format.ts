const TIME_ZONE = "Europe/Helsinki";

type DateParts = { weekday: string; day: string; month: string; year: string; hour: string; minute: string };

function partsOf(date: Date): DateParts {
  const formatter = new Intl.DateTimeFormat("fi-FI", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: parts.weekday ?? "",
    day: parts.day ?? "",
    month: parts.month ?? "",
    year: parts.year ?? "",
    hour: parts.hour ?? "",
    minute: parts.minute ?? "",
  };
}

/** "10.9." in the current year, "10.9.2025" otherwise. */
export function formatDay(date: Date, now: Date): string {
  const { day, month, year } = partsOf(date);
  return year === partsOf(now).year ? `${day}.${month}.` : `${day}.${month}.${year}`;
}

/** "la 14.11." with the weekday, for run ends and closing dates. */
export function formatWeekdayDay(date: Date, now: Date): string {
  return `${partsOf(date).weekday} ${formatDay(date, now)}`;
}

/** "pe 23.10. klo 19.00": how people plan a theatre evening. */
export function formatPerformance(date: Date, now: Date): string {
  const { hour, minute } = partsOf(date);
  return `${formatWeekdayDay(date, now)} klo ${hour}.${minute}`;
}

export function helsinkiYear(date: Date): number {
  return Number(partsOf(date).year);
}
