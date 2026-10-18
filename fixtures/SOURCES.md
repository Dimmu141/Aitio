# Where the fixtures came from

Parser tests run against these saved pages. `pnpm fixtures:refresh` re-downloads all of
them with our own polite fetcher; do that whenever a site changes, then run `pnpm test`.

| Fixtures | Captured | How |
|---|---|---|
| `kansallisteatteri/`, `svenska-teatern/` | 18 Oct 2026 | own fetcher (milestone 1) |
| `hkt/`, `ryhmateatteri/` | 18 Oct 2026 | **Firecrawl**, because this environment's network policy blocks the theatre sites |

**Firecrawl captures are rendered after JavaScript.** Our fetcher gets the server HTML,
which can differ (on hkt.fi, for example, the performance list and calendar are filled
in by script). The parsers only rely on markup and endpoints the server sends itself,
but the first run with network access must be `pnpm fixtures:refresh && pnpm test`
before trusting a scrape. JSON endpoints were unwrapped from Firecrawl's `<html><body>`.
