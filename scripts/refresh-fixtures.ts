import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { LIST_URL as KT_LIST_URL } from "../src/scrapers/adapters/kansallisteatteri";
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
