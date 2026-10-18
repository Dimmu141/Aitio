# Where the fixtures came from

Parser tests run against these saved pages. `pnpm fixtures:refresh` re-downloads all of
them with our own polite fetcher; do that whenever a site changes, then run `pnpm test`.

| Fixtures | Captured | How |
|---|---|---|
| all six theatres | 18 Oct 2026 | own fetcher (`politeFetch`), server HTML before JavaScript |

The milestone 4 fixtures came from Firecrawl (after JavaScript) because cloud sessions were
blocked from the theatre sites. They were replaced on 18 Oct 2026 by the first live run;
see "What the live run changed" below.

In a cloud session, Node's built-in fetch ignores `HTTPS_PROXY`; run the scripts with
`NODE_USE_ENV_PROXY=1` (Node 22.21 or later).

Things these captures taught us, which a refresh must keep true:

- **kansallisteatteri.fi** marks subtitles per performance (`.subtitle-indicator`) and names
  the languages in the production's info text ("Tekstitys saatavilla englanniksi ja
  suomeksi … valituissa näytännöissä"). `production-lady-t.html` has them on 9 of 10 dates.
- **hkt.fi** loads performances from `/wp-json/hkt/ticket-list/<post id>/`. Its `timestamp`
  field is Helsinki wall-clock time encoded as UTC; use `date` and `time`. Credits include
  rights agencies ("Oikeuksien valvoja"), which are skipped.
- **espoonteatteri.fi**: both the repertoire and each production's performances come from
  `POST /wp-admin/admin-ajax.php` (`action=get_dynamic_content` with no filters, and
  `action=get_event_shows&event_id=<eventShowsId>`); the pages themselves are empty shells.
  Productions show only their next few performances ("Yht. 22 näytöstä", 5 listed); the
  full list is only in its Lippu.fi shop, which we don't fetch. Team cells are free text
  with company names after a slash. `kalenteri.html` is unused, kept for reference.
- **kom-teatteri.fi**'s REST child-page list mixes productions with workshops and
  announcements; the adapter uses the curated repertoire page and the calendar. The
  production's ticket link is the "OSTA LIPUT" link on its page. The repertoire can link to
  pages that don't exist (Trio Kaipuu, 404 on 18 Oct 2026); runs log those as missing.
- **ryhmateatteri.fi** has one production on (checked against its own programme page on
  18 Oct 2026; `ohjelmisto-liput.html` is kept for reference, not used by the tests).

## What the live run changed (18 Oct 2026)

| Source | Firecrawl fixtures said | Live server HTML | Fix |
|---|---|---|---|
| Espoo list | repertoire in the page, paginated | empty shell, filled by `get_dynamic_content` | adapter posts to admin-ajax.php |
| Espoo performances | in the page | only via `get_event_shows` | fixtures `shows-*.html` |
| Espoo credits | clean names | "Name / Company", descriptive phrases | `personName` |
| Kansallisteatteri | no subtitle data | per-performance indicators | parsed, `production-lady-t.html` |
| HKT credits | – | rights agencies, "Kirjailija" | skipped / WRITER |
| KOM | – | ticket link only on the page; one dead link | production ticket link; 404 = missing |
