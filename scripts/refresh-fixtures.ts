import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CALENDAR_URL as AVOIMET_OVET_CALENDAR_URL } from "../src/scrapers/adapters/avoimet-ovet";
import { LIST_URL as OOPPERA_LIST_URL } from "../src/scrapers/adapters/kansallisooppera";
import { LIST_URL as KT_LIST_URL } from "../src/scrapers/adapters/kansallisteatteri";
import { AJAX_URL as ESPOO_AJAX_URL, LIST_FORM as ESPOO_LIST_FORM, showsForm } from "../src/scrapers/adapters/espoon-teatteri";
import { LIST_URL as HKT_LIST_URL } from "../src/scrapers/adapters/hkt";
import { CALENDAR_URL as KOM_CALENDAR_URL, LIST_URL as KOM_LIST_URL } from "../src/scrapers/adapters/kom-teatteri";
import { LIST_URL as Q_LIST_URL } from "../src/scrapers/adapters/q-teatteri";
import { listUrl as ryhmaListUrl } from "../src/scrapers/adapters/ryhmateatteri";
import { showsUrl } from "../src/scrapers/adapters/svenska-teatern";
import { LIST_URL as TAKOMO_LIST_URL } from "../src/scrapers/adapters/takomo";
import { listUrl as tanssinTaloListUrl } from "../src/scrapers/adapters/tanssin-talo";
import { LIST_URL as VIIRUS_LIST_URL } from "../src/scrapers/adapters/viirus";
import { LIST_URL as ZODIAK_LIST_URL } from "../src/scrapers/adapters/zodiak";
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
  // A preview before the premiere, whose row is marked "Ensi-ilta" (18.11.2026).
  {
    url: "https://www.kansallisteatteri.fi/esitys/taru-hohtavasta-helmesta",
    file: "fixtures/kansallisteatteri/production-taru-hohtavasta-helmesta.html",
  },
  // A guest run: "Kantaesitys oli Tampereen Työväen Teatterissa", no premiere of its own.
  { url: "https://www.kansallisteatteri.fi/esitys/karpaset", file: "fixtures/kansallisteatteri/production-karpaset.html" },
  // No dates yet (spring 2027); "Ohjaus ja dramatisointi" and the original author, Aleksis Kivi.
  {
    url: "https://www.kansallisteatteri.fi/esitys/seitseman-veljesta",
    file: "fixtures/kansallisteatteri/production-seitseman-veljesta.html",
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
  // Pages marked "past" or "temporary" drop off their site; replace them (and the tests) when they 404.
  { url: OOPPERA_LIST_URL, file: "fixtures/kansallisooppera/ohjelmisto.html" },
  { url: "https://oopperabaletti.fi/ohjelmisto/figaron-haat/", file: "fixtures/kansallisooppera/production-figaron-haat.html" },
  { url: "https://oopperabaletti.fi/ohjelmisto/hamlet/", file: "fixtures/kansallisooppera/production-hamlet.html" },
  { url: "https://oopperabaletti.fi/ohjelmisto/aistit/", file: "fixtures/kansallisooppera/production-aistit.html" },
  { url: ZODIAK_LIST_URL, file: "fixtures/zodiak/ohjelmisto.html" },
  { url: "https://www.zodiak.fi/fi/ohjelmisto/ghosts-rosegarden", file: "fixtures/zodiak/production-ghosts-rosegarden.html" },
  { url: "https://www.zodiak.fi/fi/ohjelmisto/lampi-2", file: "fixtures/zodiak/production-lampi-2.html" },
  // Past (Aug–Sep 2026).
  { url: "https://www.zodiak.fi/fi/ohjelmisto/sotku-ja-rakkaus", file: "fixtures/zodiak/production-sotku-ja-rakkaus.html" },
  // The API returns entries ending on or after this date; keep it fixed so the tests stay stable.
  { url: tanssinTaloListUrl(new Date("2026-10-18T09:00:00Z")), file: "fixtures/tanssin-talo/ohjelma-api.json" },
  {
    url: "https://www.tanssintalo.fi/ohjelma/alpo-aaltokoski-company-kolmen-soolon-juhla",
    file: "fixtures/tanssin-talo/production-kolmen-soolon-juhla.html",
  },
  {
    url: "https://www.tanssintalo.fi/ohjelma/carl-knif-company-vaasabaroque",
    file: "fixtures/tanssin-talo/production-carl-knif-vaasabaroque.html",
  },
  // Past (22–26 Sep 2026): its test checks a triple bill's credits only.
  { url: "https://www.tanssintalo.fi/ohjelma/wild-is-the-wind", file: "fixtures/tanssin-talo/production-wild-is-the-wind.html" },
  { url: "https://www.tanssintalo.fi/ohjelma/talvisirkus-väri", file: "fixtures/tanssin-talo/production-talvisirkus-vari.html" },
  { url: Q_LIST_URL, file: "fixtures/q-teatteri/esitykset.html" },
  { url: "https://www.q-teatteri.fi/esitykset/suliko", file: "fixtures/q-teatteri/production-suliko.html" },
  { url: "https://www.q-teatteri.fi/esitykset/aukeema---nayttamoessee", file: "fixtures/q-teatteri/production-aukeema.html" },
  // Past, from the archive.
  { url: "https://www.q-teatteri.fi/esitykset/kolme-sisarta", file: "fixtures/q-teatteri/production-kolme-sisarta.html" },
  { url: TAKOMO_LIST_URL, file: "fixtures/takomo/ohjelmisto.html" },
  // Temporary: moves to the archive after its run.
  {
    url: "https://teatteritakomo.fi/ohjelmisto/kadonnutta-aikaa-etsimassa-2017-2027-osa-9/",
    file: "fixtures/takomo/production-kadonnutta-aikaa-etsimassa-osa-9.html",
  },
  {
    url: "https://teatteritakomo.fi/ohjelmisto/etelapohjalaisia-lahdenmaki-viitasaari/",
    file: "fixtures/takomo/production-etelapohjalaisia.html",
  },
  { url: "https://teatteritakomo.fi/ohjelmisto/puhutaan-richardista/", file: "fixtures/takomo/production-puhutaan-richardista.html" },
  // Temporary.
  { url: "https://teatteritakomo.fi/ohjelmisto/962/", file: "fixtures/takomo/production-pahkinansarkijan-joulu.html" },
  { url: VIIRUS_LIST_URL, file: "fixtures/viirus/repertoar.html" },
  { url: "https://www.viirus.fi/sv/forestallningar/collage/", file: "fixtures/viirus/production-collage.html" },
  { url: "https://www.viirus.fi/sv/forestallningar/diptyk/", file: "fixtures/viirus/production-diptyk.html" },
  { url: "https://www.viirus.fi/sv/forestallningar/heavenly-father/", file: "fixtures/viirus/production-heavenly-father.html" },
  { url: "https://www.viirus.fi/sv/forestallningar/1984/", file: "fixtures/viirus/production-1984.html" },
  { url: AVOIMET_OVET_CALENDAR_URL, file: "fixtures/avoimet-ovet/kalenteri.html" },
  { url: "https://www.avoimetovet.fi/soteorpo/", file: "fixtures/avoimet-ovet/production-soteorpo.html" },
  { url: "https://www.avoimetovet.fi/magdag/", file: "fixtures/avoimet-ovet/production-magdag.html" },
  // Past guest show (7 Oct 2026).
  { url: "https://www.avoimetovet.fi/kullervo/", file: "fixtures/avoimet-ovet/production-kullervo.html" },
  { url: "https://www.avoimetovet.fi/aurinkokuninkaani/", file: "fixtures/avoimet-ovet/production-aurinkokuninkaani.html" },
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
