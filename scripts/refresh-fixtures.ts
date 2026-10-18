import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { LIST_URL as KT_LIST_URL } from "../src/scrapers/adapters/kansallisteatteri";
import { AJAX_URL as ESPOO_AJAX_URL, LIST_FORM as ESPOO_LIST_FORM, showsForm } from "../src/scrapers/adapters/espoon-teatteri";
import { LIST_URL as HKT_LIST_URL } from "../src/scrapers/adapters/hkt";
import { CALENDAR_URL as KOM_CALENDAR_URL, LIST_URL as KOM_LIST_URL } from "../src/scrapers/adapters/kom-teatteri";
import { listUrl as ryhmaListUrl } from "../src/scrapers/adapters/ryhmateatteri";
import { showsUrl } from "../src/scrapers/adapters/svenska-teatern";
import { politeFetch } from "../src/scrapers/http";

/**
 * Re-download the live pages that the parser tests use.
 * Run it when a site changes, then run `pnpm test` and fix the parsers.
 * Expected values in the tests (titles, counts) may need updating afterwards.
 */
/** `form` makes it a POST, like the theatre's own script sends (Espoo's admin-ajax.php). */
const FIXTURES: Array<{ url: string; file: string; form?: Record<string, string> }> = [
  { url: KT_LIST_URL, file: "fixtures/kansallisteatteri/list-esitykset-a-o.html" },
  {
    url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
    file: "fixtures/kansallisteatteri/production-viidakon-villit-naiset.html",
  },
  // Subtitles at 9 of its 10 performances.
  { url: "https://www.kansallisteatteri.fi/esitys/lady-t-0", file: "fixtures/kansallisteatteri/production-lady-t.html" },
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
  { url: KOM_LIST_URL, file: "fixtures/kom-teatteri/ohjelmisto.html" },
  { url: KOM_CALENDAR_URL, file: "fixtures/kom-teatteri/kalenteri.html" },
  { url: "https://kom-teatteri.fi/ohjelmisto/mysteriobuffo/", file: "fixtures/kom-teatteri/production-mysteriobuffo.html" },
  { url: ESPOO_AJAX_URL, form: ESPOO_LIST_FORM, file: "fixtures/espoon-teatteri/ohjelmisto-ajax.html" },
  {
    url: "https://espoonteatteri.fi/ohjelmisto/rakastavaisten-kuoro/",
    file: "fixtures/espoon-teatteri/production-rakastavaisten-kuoro.html",
  },
  {
    url: "https://espoonteatteri.fi/ohjelmisto/legend-of-harri-kala/",
    file: "fixtures/espoon-teatteri/production-legend-of-harri-kala.html",
  },
  {
    url: "https://espoonteatteri.fi/ohjelmisto/mi-madre-y-el-dinero/",
    file: "fixtures/espoon-teatteri/production-mi-madre-y-el-dinero.html",
  },
  // The eventShowsId of each production page above.
  { url: ESPOO_AJAX_URL, form: showsForm("341"), file: "fixtures/espoon-teatteri/shows-rakastavaisten-kuoro.html" },
  { url: ESPOO_AJAX_URL, form: showsForm("338"), file: "fixtures/espoon-teatteri/shows-legend-of-harri-kala.html" },
];

async function main(): Promise<void> {
  for (const fixture of FIXTURES) {
    const body = await politeFetch(fixture.url, fixture.form);
    await mkdir(dirname(fixture.file), { recursive: true });
    await writeFile(fixture.file, body);
    console.log(`saved ${fixture.file} (${body.length} bytes)`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
