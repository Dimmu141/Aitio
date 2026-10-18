import { groupCredits } from "./catalogue/credits";
import type { ProductionPage } from "./catalogue/queries";

const MAX_EVENTS = 20;
const MAX_PERFORMERS = 12;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function person(name: string): Json {
  return { "@type": "Person", name };
}

/** schema.org TheaterEvent per upcoming performance, built only from facts we store. */
export function productionJsonLd(page: ProductionPage, url: string): Json[] {
  const groups = groupCredits(page.credits);
  const names = (role: string) => groups.find((group) => group.role === role)?.people.map((p) => p.name) ?? [];
  const directors = names("DIRECTOR").map(person);
  const performers = names("CAST").slice(0, MAX_PERFORMERS).map(person);
  const location: Json = {
    "@type": "PerformingArtsTheater",
    name: page.stage ? `${page.theatre.name}, ${page.stage}` : page.theatre.name,
    address: { "@type": "PostalAddress", addressLocality: page.theatre.city, addressCountry: "FI" },
  };

  return page.performances.slice(0, MAX_EVENTS).map((performance) => {
    const event: Record<string, Json> = {
      "@context": "https://schema.org",
      "@type": "TheaterEvent",
      name: page.title,
      url,
      startDate: performance.startsAt.toISOString(),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: performance.stage
        ? { ...(location as Record<string, Json>), name: `${page.theatre.name}, ${performance.stage}` }
        : location,
      organizer: { "@type": "Organization", name: page.theatre.name, url: page.theatre.website },
    };
    if (page.languages.length > 0) event.inLanguage = page.languages;
    if (directors.length > 0) event.director = directors;
    if (performers.length > 0) event.performer = performers;
    const ticketUrl = performance.ticketUrl ?? page.ticketUrl;
    if (ticketUrl) event.offers = { "@type": "Offer", url: ticketUrl };
    return event;
  });
}

/** Safe for a <script> element: no "</script>" breakout. */
export function serializeJsonLd(value: Json): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
