# Where the fixtures came from

Parser tests run against these saved pages. `pnpm fixtures:refresh` re-downloads all of
them with our own polite fetcher; do that whenever a site changes, then run `pnpm test`.

| Fixtures | Captured | How |
|---|---|---|
| `kansallisteatteri/`, `svenska-teatern/` | 18 Oct 2026 | own fetcher (milestone 1) |
| `hkt/`, `ryhmateatteri/`, `kom-teatteri/`, `espoon-teatteri/` | 18 Oct 2026 | **Firecrawl**, because this environment's network policy blocks the theatre sites |

**Firecrawl captures are rendered after JavaScript.** Our fetcher gets the server HTML,
which can differ (on hkt.fi, for example, the performance list and calendar are filled
in by script). The parsers only rely on markup and endpoints the server sends itself,
but the first run with network access must be `pnpm fixtures:refresh && pnpm test`
before trusting a scrape. JSON endpoints were unwrapped from Firecrawl's `<html><body>`.

Things these captures taught us, which a refresh must keep true:

- **hkt.fi** loads performances from `/wp-json/hkt/ticket-list/<post id>/`. Its `timestamp`
  field is Helsinki wall-clock time encoded as UTC; use `date` and `time`.
- **espoonteatteri.fi** loads performances with `POST /wp-admin/admin-ajax.php`
  (`action=get_event_shows`) and shows only the next few; the full list is only in its
  Lippu.fi shop, which we don't fetch. `/ohjelmisto/page/2/` repeats page 1.
  The calendar page (`kalenteri.html`) was captured for reference but is not used: it is
  as incomplete as the production pages.
- **kom-teatteri.fi**'s REST child-page list mixes productions with workshops and
  announcements; the adapter uses the curated repertoire page and the calendar.
- **ryhmateatteri.fi** has one production on (checked against its own repertoire page,
  `ohjelmisto-liput.html`).
