import "dotenv/config";
import { readFileSync } from "node:fs";
import * as espoo from "../src/scrapers/adapters/espoon-teatteri";
import * as hkt from "../src/scrapers/adapters/hkt";
import * as kansallisteatteri from "../src/scrapers/adapters/kansallisteatteri";
import * as kom from "../src/scrapers/adapters/kom-teatteri";
import * as ryhma from "../src/scrapers/adapters/ryhmateatteri";
import * as svenskaTeatern from "../src/scrapers/adapters/svenska-teatern";
import { upsertProduction } from "../src/scrapers/normalise";
import type { RawProduction, RawProductionDetail } from "../src/scrapers/types";
import { db } from "../src/lib/db";

/**
 * Dev only: load the saved fixture pages into the database through the real
 * parsers and normaliser, so pages have real-shaped data without network access.
 * The data is a snapshot from the fixture capture date; a real scrape overwrites it.
 */
function read(path: string): string {
  return readFileSync(path, "utf8");
}

function findRef(refs: RawProduction[], url: string): RawProduction {
  const ref = refs.find((candidate) => candidate.url === url);
  if (!ref) throw new Error(`No list entry for ${url} in the fixtures`);
  return ref;
}

function fixtureDetails(): Array<{ sourceId: string; detail: RawProductionDetail }> {
  const ktRefs = kansallisteatteri.parseList(read("fixtures/kansallisteatteri/list-esitykset-a-o.html"));
  const ktRef = findRef(ktRefs, "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset");
  const stRefs = svenskaTeatern.parseShowsJson(read("fixtures/svenska-teatern/shows-page-1.json"));
  const stRef = findRef(stRefs, "https://svenskateatern.fi/repertoar/nattland/");
  return [
    {
      sourceId: kansallisteatteri.kansallisteatteriAdapter.id,
      detail: kansallisteatteri.parseDetail(read("fixtures/kansallisteatteri/production-viidakon-villit-naiset.html"), ktRef),
    },
    {
      sourceId: svenskaTeatern.svenskaTeaternAdapter.id,
      detail: svenskaTeatern.parseDetail(read("fixtures/svenska-teatern/production-nattland.html"), stRef),
    },
    {
      sourceId: hkt.hktAdapter.id,
      detail: hkt.parseDetail(
        read("fixtures/hkt/production-julia.html"),
        read("fixtures/hkt/ticket-list-47167.json"),
        findRef(hkt.parseList(read("fixtures/hkt/list-esitykset.html")), "https://hkt.fi/esitykset/julia/"),
      ),
    },
    {
      sourceId: hkt.hktAdapter.id,
      detail: hkt.parseDetail(
        read("fixtures/hkt/production-de-obehoriga.html"),
        null,
        findRef(hkt.parseList(read("fixtures/hkt/list-esitykset.html")), "https://hkt.fi/esitykset/de-obehoriga/"),
      ),
    },
    {
      sourceId: ryhma.ryhmateatteriAdapter.id,
      detail: ryhma.parseDetail(
        read("fixtures/ryhmateatteri/production-aitisi-klytaimestra.html"),
        ryhma.parseRestList(read("fixtures/ryhmateatteri/artist-page-1.json"))[0],
      ),
    },
    {
      sourceId: kom.komTeatteriAdapter.id,
      detail: kom.parseDetail(
        read("fixtures/kom-teatteri/production-mysteriobuffo.html"),
        read("fixtures/kom-teatteri/kalenteri.html"),
        findRef(kom.parseList(read("fixtures/kom-teatteri/ohjelmisto.html")), "https://kom-teatteri.fi/ohjelmisto/mysteriobuffo/"),
      ),
    },
    ...["rakastavaisten-kuoro", "legend-of-harri-kala"].map((slug) => ({
      sourceId: espoo.espoonTeatteriAdapter.id,
      detail: espoo.parseDetail(
        read(`fixtures/espoon-teatteri/production-${slug}.html`),
        null,
        findRef(espoo.parseList(read("fixtures/espoon-teatteri/ohjelmisto.html")), `https://espoonteatteri.fi/ohjelmisto/${slug}/`),
      ),
    })),
  ];
}

async function main(): Promise<void> {
  const seenAt = new Date();
  for (const { sourceId, detail } of fixtureDetails()) {
    const theatre = await db.theatre.findUnique({ where: { sourceId } });
    if (!theatre) throw new Error(`No theatre with sourceId "${sourceId}". Run pnpm db:seed first.`);
    const summary = await upsertProduction(db, theatre, detail, seenAt);
    console.log(
      `${sourceId}: ${summary.slug} (${summary.performances} performances, ${summary.credits} credits, ${summary.reviews} reviews)`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
