export interface TheatreSeed {
  slug: string;
  name: string;
  city: string;
  website: string;
  ticketingProvider: string;
  sourceId: string;
}

export const THEATRES: readonly TheatreSeed[] = [
  {
    slug: "kansallisteatteri",
    name: "Kansallisteatteri",
    city: "Helsinki",
    website: "https://www.kansallisteatteri.fi",
    ticketingProvider: "lippu.fi",
    sourceId: "kansallisteatteri",
  },
  {
    slug: "svenska-teatern",
    name: "Svenska Teatern",
    city: "Helsinki",
    website: "https://svenskateatern.fi",
    ticketingProvider: "tixly",
    sourceId: "svenska-teatern",
  },
  {
    slug: "helsingin-kaupunginteatteri",
    name: "Helsingin Kaupunginteatteri",
    city: "Helsinki",
    website: "https://hkt.fi",
    ticketingProvider: "lippu.fi",
    sourceId: "hkt",
  },
  {
    slug: "ryhmateatteri",
    name: "Ryhmäteatteri",
    city: "Helsinki",
    website: "https://www.ryhmateatteri.fi",
    ticketingProvider: "tiketti",
    sourceId: "ryhmateatteri",
  },
  {
    slug: "kom-teatteri",
    name: "KOM-teatteri",
    city: "Helsinki",
    website: "https://kom-teatteri.fi",
    ticketingProvider: "lippu.fi",
    sourceId: "kom-teatteri",
  },
  {
    slug: "espoon-teatteri",
    name: "Espoon Teatteri",
    city: "Espoo",
    website: "https://espoonteatteri.fi",
    ticketingProvider: "lippu.fi",
    sourceId: "espoon-teatteri",
  },
];

/** Sources that list only the next few performances (adapters set `performancesPartial`). */
const PARTIAL_SCHEDULE_SOURCES: ReadonlySet<string> = new Set(["espoon-teatteri"]);

/** Whether a theatre's upcoming performances are complete enough to count what's left. */
export function hasFullSchedule(theatreSlug: string): boolean {
  const theatre = THEATRES.find((candidate) => candidate.slug === theatreSlug);
  return theatre !== undefined && !PARTIAL_SCHEDULE_SOURCES.has(theatre.sourceId);
}
