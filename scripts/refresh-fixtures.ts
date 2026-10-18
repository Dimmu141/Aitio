import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { LIST_URL as KT_LIST_URL } from "../src/scrapers/adapters/kansallisteatteri";
import { LIST_URL as HKT_LIST_URL } from "../src/scrapers/adapters/hkt";
import { listUrl as ryhmaListUrl } from "../src/scrapers/adapters/ryhmateatteri";
import { showsUrl } from "../src/scrapers/adapters/svenska-teatern";
import { politeFetch } from "../src/scrapers/http";

/**
 * Re-download the live pages that the parser tests use.
 * Run it when a site changes, then run `pnpm test` and fix the parsers.
 * Expected values in the tests (titles, counts) may need updating afterwards.
 */
const FIXTURES: Array<{ url: string; file: string }> = [
  { url: KT_LIST_URL, file: "fixtures/kansallisteatteri/list-esitykset-a-o.html" },
  {
    url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
    file: "fixtures/kansallisteatteri/production-viidakon-villit-naiset.html",
  },
  { url: showsUrl(1), file: "fixtures/svenska-teatern/shows-page-1.json" },
  { url: "https://svenskateatern.fi/repertoar/nattland/", file: "fixtures/svenska-teatern/production-nattland.html" },
  { url: HKT_LIST_URL, file: "fixtures/hkt/list-esitykset.html" },
  { url: `${HKT_LIST_URL}page/2/`, file: "fixtures/hkt/list-esitykset-page-2.html" },
  { url: "https://hkt.fi/esitykset/julia/", file: "fixtures/hkt/production-julia.html" },
  { url: "https://hkt.fi/esitykset/de-obehoriga/", file: "fixtures/hkt/production-de-obehoriga.html" },
  { url: "https://hkt.fi/wp-json/hkt/ticket-list/47167/", file: "fixtures/hkt/ticket-list-47167.json" },
  { url: ryhmaListUrl(1), file: "fixtures/ryhmateatteri/artist-page-1.json" },
  {
    url: "https://www.ryhmateatteri.fi/ohjelma/aitisi-klytaimestra/",
    file: "fixtures/ryhmateatteri/production-aitisi-klytaimestra.html",
  },
];

async function main(): Promise<void> {
  for (const fixture of FIXTURES) {
    const body = await politeFetch(fixture.url);
    await mkdir(dirname(fixture.file), { recursive: true });
    await writeFile(fixture.file, body);
    console.log(`saved ${fixture.file} (${body.length} bytes)`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
