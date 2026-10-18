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

## Sources added 18 Oct 2026 (dance, opera and independent theatres)

All captured with `politeFetch` on 18 Oct 2026 from server HTML; robots.txt allows every
path used. None of these sources lists only the next few dates (`hasFullSchedule` is true).

- **oopperabaletti.fi** (Kansallisooppera ja -baletti) disallows `/wp-json/`. The season is a
  JSON array in `data-posts` on `/ohjelmisto/`; performances are schema.org `Event` JSON-LD
  on each production page (`startDate` is Helsinki wall-clock without an offset). The printed
  genre sets `typeHint` (Ooppera → OPERA, Baletti/Nykytanssi → DANCE). "Kieli" holds the sung
  language and surtitles. Tours, tea dances, free foyer events, Stage24 streams and concerts
  at other venues are skipped. Conductors ("Musiikinjohto") are OTHER, not COMPOSER.
- **zodiak.fi** lists each current production with every date on `/fi/ohjelmisto`; dates carry
  `data-date="YYYY-MM-DD"`. Only `type-esitykset` items are kept (no panels, seminars or free
  Z-Lab showings). Some productions play at Tanssin talo (Ghosts of Rosegarden, Oct 2026), so
  the same evening can come from both sources.
- **tanssintalo.fi** (Craft CMS): `/ohjelma` is an empty shell filled from the site's own
  public GraphQL endpoint at `/api`; we send the same query as a GET (entries ending on or after
  today). Performances, categories and organisers come from the API (`date` + the clock part of
  `time`, Helsinki time); title, stage, duration, ticket link and credits from the page.
  Workshops, talks, seminars, screenings and professional events are skipped, and so are
  entries organised by Zodiak, which the zodiak source owns. Category Tanssi → DANCE,
  Musiikki → CONCERT.
- **q-teatteri.fi** (with a hyphen) is Webflow without an API. Dates are hand-written: month
  rows with starred matinees, or one line per date; the year comes from the weekday or the
  season box. Announced cancellations ("PERUUTUS!") are dropped. Puoli-Q is its small stage.
- **teatteritakomo.fi** (takomo.fi does not resolve): the REST `shows` posts have no
  performances, so `/ohjelmisto/` and each page's `.show` rows are read. Years come from the
  printed weekday. Off-site venues are only named in prose; `KNOWN_VENUES` in the adapter
  lists the ones seen (Hanasaari, Teatterimuseo, …). Two rows at one time are ticket types.
- **viirus.fi** is Next.js over headless WordPress: every page carries its WPGraphQL data in
  `__NEXT_DATA__`. Swedish pages only (fi/en are translations of the same posts). `showType`
  "guest" marks visiting productions. No stage is named. Languages and subtitles come from
  the "Språk" and "Textning" lines.
- **avoimetovet.fi** (Teatteri Avoimet Ovet): the whole season is `data-events` JSON on
  `/kalenteri/`, with full dates. Guest stand-up nights link straight to lippu.fi and become
  visiting productions grouped by title (the ticket link is stored, never fetched).
  "Visiting" otherwise comes from the VIERAILUOHJELMISTO menu, so a guest show that has left
  the menu reads as the theatre's own.
