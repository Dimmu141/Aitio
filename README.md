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
| Tests | 117 unit tests (`pnpm test`) and 40 Playwright smoke tests at 360px with and without JavaScript (`pnpm test:e2e`) at the end of milestone 2 |

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

## Status: milestone 3 (users and diary)

| Done | Notes |
|---|---|
| Sign-in with email links | Better Auth (not Auth.js, see BRIEF.md section 2), magic-link plugin, Prisma adapter, 20-minute links, 90-day sessions, no passwords |
| Merkitse nähdyksi | `/merkitse/<slug>`: two taps (preselected date, sticky Tallenna); optional half-star rating, review (500 chars), up to 3 tags, rewatch |
| Diary | `/paivakirja`: ticket stubs grouped by year, edit and delete |
| Production page | "Merkitse nähdyksi" + "Osta liput", rating histogram, tag counts, public reviews with a report link; still fully static |
| Moderation | report page, three distinct reporters auto-hide a review, `pnpm moderation` to list, hide or show |
| Rate limits | sign-in emails per address and per IP, diary saves and reports per user per day; stored in Postgres |
| GDPR | settings page: display name, sign out, download all data (JSON), delete account |
| Tests | 161 unit and integration tests, 54 Playwright tests with and without JavaScript |

### Configuration

| Variable | Needed | What for |
|---|---|---|
| `BETTER_AUTH_SECRET` | production | signs session cookies; `openssl rand -base64 32` |
| `SITE_URL` | production | public origin for links in emails, canonical URLs, sitemap |
| `RESEND_API_KEY`, `EMAIL_FROM` | production | sends sign-in emails; without a key dev prints links to the console |
| `REVALIDATE_SECRET` | optional | lets `pnpm moderation` (and later the scraper) clear cached pages at once |
| `DEV_EMAIL_LOG_FILE` | tests only | e2e tests read sign-in links from this file; refused on Vercel production |

Sign in locally: `pnpm dev`, enter any address on `/kirjaudu`, copy the link from the terminal.

### How it fits together

- **Public pages stay static.** Nothing personal is rendered on them; "Merkitse nähdyksi" is a link to a separate dynamic page. Saving or deleting an entry calls `updateTag("production:<slug>")`, so the production page shows the change on the next request.
- **Signed-out visitors** of personal pages are redirected in `proxy.ts` (cookie present or not), because a redirect from a page arrives after the prerendered layout and only works with JavaScript. Pages still verify the session (`requireUser`).
- **Email links land on a confirmation page** with a button instead of signing in straight away: Outlook Safe Links and similar scanners open links in incoming mail and would use up the one-time token.
- **Forms are plain server-action forms**, so every flow, including sign-in, works without JavaScript; the e2e suite runs all of it both ways.
- **Ratings** are stored as half-stars 1-10, `seenOn` as a calendar date.

### Known gaps

- **No privacy policy page.** We now store email addresses, names and reviews, so a tietosuojaseloste is required before launch, plus a decision on Resend: it is a US company. Resend can send from an EU region, but check its DPA, or switch `src/lib/email.ts` to a Finnish/EU SMTP provider.
- **Form errors lose the input.** A rejected form (e.g. a future date) redirects back with the message but without what was typed; the inputs are constrained enough that this is rare.
- **No public profiles or following.** Reviews show a display name only; the diary is private.
- **Moderation is a CLI.** Fine for a handful of reports a week; an admin page belongs in milestone 4 with the type-override page.
- **An expired session cookie without JavaScript** on a personal page shows the sign-in redirect only with JS (the proxy sees a cookie and lets it through).
- **e2e tests need the dev database** and delete their own `@example.fi` users afterwards; point `DATABASE_URL` at a disposable database if you'd rather not touch dev data.

## Next: milestone 4

Remaining adapters (HKT, Ryhmäteatteri, KOM, Espoo), Vercel Cron, ScrapeRun monitoring, admin page for type overrides and moderation. The cron route should POST to `/api/revalidate` after a run. See `BRIEF.md` section 8.
