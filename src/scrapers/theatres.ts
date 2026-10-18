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
  {
    slug: "kansallisooppera-ja-baletti",
    name: "Kansallisooppera ja -baletti",
    city: "Helsinki",
    website: "https://oopperabaletti.fi",
    ticketingProvider: "oopperabaletti",
    sourceId: "kansallisooppera",
  },
  {
    slug: "zodiak",
    name: "Zodiak – Uuden tanssin keskus",
    city: "Helsinki",
    website: "https://www.zodiak.fi",
    ticketingProvider: "tixly",
    sourceId: "zodiak",
  },
  {
    slug: "tanssin-talo",
    name: "Tanssin talo",
    city: "Helsinki",
    website: "https://www.tanssintalo.fi",
    ticketingProvider: "tixly",
    sourceId: "tanssin-talo",
  },
  {
    slug: "q-teatteri",
    name: "Q-teatteri",
    city: "Helsinki",
    website: "https://www.q-teatteri.fi",
    ticketingProvider: "tiketti",
    sourceId: "q-teatteri",
  },
  {
    slug: "teatteri-takomo",
    name: "Teatteri Takomo",
    city: "Helsinki",
    website: "https://teatteritakomo.fi",
    ticketingProvider: "tiketti",
    sourceId: "takomo",
  },
  {
    slug: "teater-viirus",
    name: "Teater Viirus",
    city: "Helsinki",
    website: "https://www.viirus.fi",
    ticketingProvider: "fienta",
    sourceId: "viirus",
  },
  {
    slug: "teatteri-avoimet-ovet",
    name: "Teatteri Avoimet Ovet",
    city: "Helsinki",
    website: "https://www.avoimetovet.fi",
    ticketingProvider: "lippu.fi",
    sourceId: "avoimet-ovet",
  },
];

/** Sources that list only the next few performances (adapters set `performancesPartial`). */
const PARTIAL_SCHEDULE_SOURCES: ReadonlySet<string> = new Set(["espoon-teatteri"]);

/** Whether a theatre's upcoming performances are complete enough to count what's left. */
export function hasFullSchedule(theatreSlug: string): boolean {
  const theatre = THEATRES.find((candidate) => candidate.slug === theatreSlug);
  return theatre !== undefined && !PARTIAL_SCHEDULE_SOURCES.has(theatre.sourceId);
}
