# Aitio

A mobile-first website for logging, rating and discovering theatre in Finland: Letterboxd mechanics, Untappd-style check-ins, Show-Score-style tags. See [`BRIEF.md`](BRIEF.md) for the full project brief and roadmap.

## Status: milestone 1 (data layer and first scrapers)

| Done | Notes |
|---|---|
| Next.js 16 + TypeScript (strict) + Tailwind scaffold | UI is still the default page; pages come in milestone 2 |
| Prisma 7 schema for theatres, stages, productions, performances, people, credits, critic links, users, diary, tags, scrape runs | `prisma/schema.prisma` |
| Seed for six Helsinki-area theatres | `prisma/seed.ts` |
| Adapter interface, Zod validation, polite fetcher (robots.txt, 1 req/s per host, own User-Agent) | `src/scrapers/` |
| Kansallisteatteri adapter (HTML) | list page, performances with exact times, working group, cast, critic review links |
| Svenska Teatern adapter (WordPress REST + HTML) | REST list, info box, performances from embedded JSON, team, ensemble with character names, subtitle languages |
| Rule-based type classifier | plays vs concerts, stand-up, talks |
| Normaliser that upserts everything idempotently and never deletes | `src/scrapers/normalise.ts` |
| Safety check: a run aborts if a source returns 0 productions or under half of the last good run | `src/scrapers/run.ts` |
| Scrape CLI with `--dry-run` and `--limit` | `scripts/scrape.ts` |
| 43 tests: parsers against real pages captured on 18 Oct 2026, pipeline, and 2 database integration tests | `pnpm test` |
| Initial migration | `prisma/migrations` |

## Getting started

Requirements: Node 22+, pnpm, a PostgreSQL database (local, or a free Neon project).

```bash
pnpm install                       # also generates the Prisma client (no .env needed yet)
cp .env.example .env               # then set DATABASE_URL
pnpm prisma migrate deploy         # creates the tables from prisma/migrations
pnpm db:seed                       # inserts the six theatres
pnpm db:seed:fixtures              # optional, dev only: loads the two saved fixture productions
pnpm scrape --dry-run --limit 3    # see what would be saved, nothing is written
pnpm scrape                        # scrape both sources into the database
pnpm test                          # parser and pipeline tests
```

Run one source: `pnpm scrape kansallisteatteri` or `pnpm scrape svenska-teatern`.

Database integration test: create an empty database, migrate it (`DATABASE_URL=<test url> pnpm prisma migrate deploy`), then run
`TEST_DATABASE_URL=postgresql://... pnpm test` (or put `TEST_DATABASE_URL` in `.env`). It wipes that database, so never point it at real data.

Schema changes: edit `prisma/schema.prisma`, run `pnpm db:migrate --name <change>`, commit the new migration folder.

Behind an HTTP proxy, Node's built-in `fetch` ignores `HTTPS_PROXY` unless you set `NODE_USE_ENV_PROXY=1`.

## When a theatre redesigns its website

1. `pnpm fixtures:refresh` downloads fresh copies of the pages the tests use.
2. `pnpm test` shows which selectors broke.
3. Fix the parser in `src/scrapers/adapters/`, update the expected values in the test, commit.

## Scraping rules

We store facts only: titles, dates, stages, credits, ticket links and links to reviews. No marketing texts, no press photos, no copied review text. Every request respects robots.txt, identifies itself (set `SCRAPER_USER_AGENT` with a contact address before going public) and waits at least a second between requests to the same host. Lippu.fi is deliberately not scraped.

## Known gaps and decisions for you

- **Person matching is by name.** Two different actors with the same name would merge. Fine for now; revisit with theatre person-page URLs as stable IDs.
- **Svenska Teatern's REST list includes about 85 shows back to 2022.** All are stored, because old productions are useful for diary entries ("I saw this in 2023"). Pages without performances just get no dates.
- **Kansallisteatteri subtitles** are shown per performance on their site; not parsed yet, so `subtitleLangs` is empty there.
- **Classifier** is keyword based; check `typeConfidence` below 0.6 manually until the admin override page exists.
- **The live fetch path has still not run end-to-end.** The cloud environment's network policy blocks the theatre sites (proxy 403), so do one `pnpm scrape --dry-run --limit 3` locally first. Migration, seed and integration tests have now run against real PostgreSQL 16.

## Status: milestone 2 (read-only site)

| Done | Notes |
|---|---|
| Ohjelmassa front page | productions playing in the next 14 days, Viimeiset esitykset box, filters as a plain GET form (works without JavaScript) |
| Production page | typographic poster, badges, run progress, ticket button, performances, audience section (empty until milestone 3), critic links, credits, TheaterEvent JSON-LD |
| Theatre and person pages | current and earlier productions; person pages across theatres |
| Finnish, Swedish, English | Finnish at `/`, `/sv/forestallning/...`, `/en/show/...`; typed dictionaries in `src/i18n/dictionaries` |
| SEO | canonical and hreflang on every page, `sitemap.xml`, `robots.txt`, real HTTP 404s |
| PWA | `manifest.webmanifest`, icons in `public/icons` (`node scripts/generate-icons.mjs` re-renders them) |
| Design | warm paper, Source Serif 4 titles, Source Sans 3 UI, oxblood accent, 18px base, 54px tap targets, AAA contrast checked in tests |
| Tests | 117 unit tests (`pnpm test`) and 40 Playwright smoke tests at 360px with and without JavaScript (`pnpm test:e2e`) |

### Running it

```bash
pnpm db:seed && pnpm db:seed:fixtures   # two real productions from the fixtures
pnpm dev                                # http://localhost:3000
pnpm build && pnpm test:e2e             # smoke tests against the production build
```

`pnpm test:e2e` uses the fixture data, so seed it first. Set `CHROMIUM_PATH` to use an existing Chromium instead of `pnpm exec playwright install chromium`. Set `SITE_URL` (e.g. `https://aitio.fi`) in production; canonical URLs, the sitemap and JSON-LD use it.

### How it fits together

- **Routing:** `src/proxy.ts` maps public URLs onto `app/[locale]/<finnish segment>/...` and redirects other spellings, so each page has one URL. Path logic lives in `src/i18n/paths.ts`.
- **Locale:** read with `next/root-params`, not next-intl. Cache Components is on, and root params are its native way to read the locale in cached server code. A missing translation fails `pnpm typecheck`.
- **Data:** `src/lib/catalogue/queries.ts` (cached one hour, tag `catalogue`) returns plain objects; the decisions that depend on time are pure functions in `select.ts` with an explicit `asOf`.
- **Current vs. stale rows:** performances and credits that left a theatre's page keep their old `lastSeenAt` and are hidden, never deleted. This hides cancelled performances and fixed parser mistakes.
- **Rendering:** detail pages use `ensureStatic = "navigation"`: fully static, and a new slug waits for its render, so a missing one is a real 404 (the default fallback shell answered 200). The front page renders per request because it reads the query string; inside Suspense it would have been invisible without JavaScript.

### Known gaps

- **Subtitle filter is off** (`SUBTITLE_FILTER_ENABLED` in `src/lib/catalogue/filters.ts`). Kansallisteatteri shows subtitles per performance, but every row in our fixture has an empty subtitle column, so the format is unknown. Needs a fixture of a subtitled production and `Performance.subtitleLangs`.
- **Cache refresh after a scrape is time-based** (up to an hour). The CLI scraper cannot call `revalidateTag`; the Vercel Cron route in milestone 4 should call `revalidateTag("catalogue")`.
- **Design roles are merged.** Lavastus, puvut, valot and so on all show as Suunnittelu, because the scraper maps labels to a few roles and drops the original label. Storing the label text would fix it.
- **Critic links show the outlet only.** Kansallisteatteri also gives the critic's name and headline; one of the two Helsingin Sanomat links is a feature article, not a review.
- **Without JavaScript**, the language links on detail pages go to the other language's front page, and the 404 page shows Next.js's generic text.
- **No OpenGraph image yet.** A typographic poster image (`opengraph-image.tsx`) would suit the brief.
- **Theatre pages without data** (four of six theatres until milestone 4) show only "Ei esityksiä ohjelmistossa juuri nyt".

## Next: milestone 3

Users and diary: auth, the "Merkitse nähdyksi" flow, diary as ticket stubs, ratings, tags, short reviews, moderation. See `BRIEF.md` section 8.
