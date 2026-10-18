import type { ProductionType } from "@/generated/prisma/enums";

const types: Record<ProductionType, string> = {
  PLAY: "Näytelmä",
  MUSICAL: "Musikaali",
  OPERA: "Ooppera",
  DANCE: "Tanssi",
  CONCERT: "Konsertti",
  STANDUP: "Stand-up",
  TALK: "Keskustelu",
  OTHER: "Muu",
};

export const fi = {
  site: {
    name: "Aitio",
    tagline: "Helsingin seudun teatterit yhdessä paikassa",
    description:
      "Mitä teattereissa on nyt ohjelmassa: esitykset, esityspäivät, tekijät ja linkit arvosteluihin Helsingin seudun teattereista.",
    skipToContent: "Siirry sisältöön",
    language: "Kieli",
    home: "Etusivu",
  },
  home: {
    title: "Ohjelmassa",
    intro: "Esitykset seuraavan kahden viikon aikana.",
    closingSoon: "Viimeiset esitykset",
    closingSoonIntro: "Nämä päättyvät kahden viikon sisällä.",
    empty: "Näillä valinnoilla ei löytynyt esityksiä. Kokeile väljempiä valintoja.",
    count: (n: number) => (n === 1 ? "1 esitys" : `${n} esitystä`),
  },
  filters: {
    legend: "Rajaa esityksiä",
    city: "Kaupunki",
    type: "Lajityyppi",
    language: "Esityskieli",
    subtitles: "Tekstitys",
    all: "Kaikki",
    apply: "Näytä esitykset",
    clear: "Tyhjennä valinnat",
  },
  production: {
    nextPerformance: "Seuraava esitys",
    noUpcoming: "Ei tulevia esityksiä.",
    performedIn: (year: number) => `Esitetty ${year}`,
    run: "Esityskausi",
    premiere: "Ensi-ilta",
    lastPerformance: "Viimeinen esitys",
    runProgress: (percent: number) => `Esityskaudesta kulunut ${percent} %`,
    buyTickets: "Osta liput",
    externalLink: "siirtyy toiselle sivustolle",
    performances: "Tulevat esitykset",
    performanceTickets: "Liput",
    stage: "Näyttämö",
    duration: "Kesto",
    language: "Kieli",
    subtitles: "Tekstitys",
    audience: "Yleisö",
    noRatings: "Ei vielä katsojien arvioita. Arviointi avautuu pian.",
    ratingsCount: (n: number) => (n === 1 ? "1 arvio" : `${n} arviota`),
    averageHidden: (needed: number) => `Keskiarvo näytetään, kun arvioita on ${needed}.`,
    critics: "Kriitikot",
    criticsIntro: "Linkit arvosteluihin muissa medioissa.",
    noCritics: "Emme ole vielä löytäneet arvosteluja.",
    credits: "Tekijät",
    source: "Lähde",
  },
  roles: {
    DIRECTOR: "Ohjaus",
    WRITER: "Teksti",
    COMPOSER: "Musiikki",
    TRANSLATOR: "Käännös",
    CHOREOGRAPHER: "Koreografia",
    DESIGNER: "Suunnittelu",
    CAST: "Rooleissa",
    OTHER: "Muut tekijät",
  },
  types,
  languages: { fi: "suomi", sv: "ruotsi", en: "englanti" } as Record<string, string>,
  theatre: {
    current: "Ohjelmistossa nyt",
    past: "Aiemmin esitetty",
    stages: "Näyttämöt",
    website: "Teatterin verkkosivut",
    noCurrent: "Ei esityksiä ohjelmistossa juuri nyt.",
  },
  person: {
    current: "Ohjelmistossa nyt",
    past: "Aiemmat produktiot",
    as: (character: string) => `roolissa ${character}`,
  },
  footer: {
    facts:
      "Aitio kokoaa esitystiedot teatterien omilta verkkosivuilta. Liput ostetaan aina teatterin omasta lippukaupasta.",
  },
  notFound: {
    title: "Sivua ei löytynyt",
    body: "Esitys on ehkä poistunut ohjelmistosta tai osoite on muuttunut.",
    back: "Takaisin etusivulle",
  },
};

export type Dictionary = typeof fi;
