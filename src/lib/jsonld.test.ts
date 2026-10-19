import { describe, expect, it } from "vitest";
import type { ProductionPage } from "./catalogue/queries";
import { summariseRatings } from "./catalogue/select";
import { productionJsonLd, serializeJsonLd } from "./jsonld";

const page: ProductionPage = {
  asOf: new Date("2026-10-18T09:00:00Z"),
  slug: "nattland-svenska-teatern",
  title: "Nattland",
  type: "PLAY",
  theatre: { slug: "svenska-teatern", name: "Svenska Teatern", city: "Helsinki", website: "https://svenskateatern.fi" },
  stage: "AMOS-scenen",
  languages: ["sv"],
  subtitleLangs: ["fi"],
  durationText: null,
  sourceUrl: "https://svenskateatern.fi/repertoar/nattland/",
  ticketUrl: "https://tickets.example/1",
  premiereDate: null,
  performances: [
    { startsAt: new Date("2026-10-20T16:00:00Z"), stage: null, ticketUrl: null, subtitleLangs: [] },
    { startsAt: new Date("2026-10-21T16:00:00Z"), stage: "Stora scenen", ticketUrl: "https://tickets.example/2", subtitleLangs: [] },
  ],
  next: null,
  last: null,
  progress: null,
  end: null,
  fullSchedule: true,
  closingSoon: false,
  phase: "running",
  started: true,
  year: null,
  credits: [
    { role: "DIRECTOR", person: { slug: "a", name: "Anna" }, characterName: null },
    { role: "CAST", person: { slug: "b", name: "Bo" }, characterName: "X" },
  ],
  critics: [],
  blogs: [],
  ratings: summariseRatings([]),
  tags: [],
  reviews: [],
  updatedAt: new Date(),
};

describe("productionJsonLd", () => {
  const events = productionJsonLd(page, "https://aitio.fi/esitys/nattland-svenska-teatern");

  it("emits one TheaterEvent per performance with our facts only", () => {
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      "@type": "TheaterEvent",
      name: "Nattland",
      startDate: "2026-10-20T16:00:00.000Z",
      inLanguage: ["sv"],
      director: [{ "@type": "Person", name: "Anna" }],
      performer: [{ "@type": "Person", name: "Bo" }],
      offers: { url: "https://tickets.example/1" },
      location: { name: "Svenska Teatern, AMOS-scenen", address: { addressLocality: "Helsinki" } },
    });
  });

  it("uses the performance's own stage and ticket link when it has them", () => {
    expect(events[1]).toMatchObject({
      offers: { url: "https://tickets.example/2" },
      location: { name: "Svenska Teatern, Stora scenen" },
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});
