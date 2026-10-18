# Aitio: notes for Claude Code

Aitio is a mobile-first website for logging, rating and discovering theatre in Finland (Letterboxd mechanics, Untappd-style check-ins, Show-Score-style tags). The owner is Dimmu: he builds with Next.js, TypeScript, Prisma, PostgreSQL and Vercel, and wants a sparring partner, not a yes-man. Push back when something in the plan is wrong.

Read `BRIEF.md` before starting new work. It holds the product decisions, data sources, scraping rules and milestones.

## Current status

- **Milestone 1 is done** (data layer + two scrapers, 43 tests). See README.md for what exists.
- **Milestone 1 first-run is done** except the live scrape: migration committed (`prisma/migrations`), seed and integration tests pass on PostgreSQL 16. `pnpm db:seed:fixtures` loads the two fixture productions for local page development.
- **Live verification done (18 Oct 2026, LAUNCH.md step 0):** all six sources fetched, fixtures refreshed from the live servers, parsers fixed, full scrape into the dev database. See `fixtures/SOURCES.md` "What the live run changed". In a cloud session, scripts that fetch need `NODE_USE_ENV_PROXY=1` (Node's fetch ignores `HTTPS_PROXY`).
- **Milestone 2 is done** (read-only site, see README.md "Status: milestone 2" and its known gaps). Decisions agreed with Dimmu and now built:
  - Finnish URLs at the root, `/sv/` and `/en/` with translated segments, via `src/proxy.ts` and `src/i18n/paths.ts` (not next-intl; see README for why).
  - "Merkitse nähdyksi" is hidden until auth exists (milestone 3); no dead buttons.
  - Past productions are indexed and in the sitemap with an "Esitetty <year>" label, but stay out of "Ohjelmassa".
  - The subtitle filter is on since 18 Oct 2026: Kansallisteatteri per-performance subtitles are parsed from a real fixture. A card matches when any performance in the next two weeks has the language.
- **Milestone 3 is done** (users and diary, see README.md "Status: milestone 3" and its known gaps). Decisions agreed with Dimmu:
  - Better Auth instead of Auth.js (BRIEF.md section 2 updated), email magic links only, no passwords or social login.
  - Reviews are public by default with a visible opt-out checkbox; ratings and tags always count anonymously.
- **Milestone 4 is done** (all six adapters, Vercel Cron, monitoring, `/yllapito`; see README.md "Status: milestone 4"). Its Firecrawl fixtures were replaced by live server HTML on 18 Oct 2026.
- **Launch decisions made:** Brevo (EU) for email, Neon in Frankfurt with Vercel functions in `fra1`, and the Hobby plan, which is enough (100 cron jobs, once a day, 300 s). The privacy policy lives in `src/lib/privacy.ts` and quotes the retention constants; when you change retention, data collected, or a provider, update it and `POLICY_DATE`.
- **Milestone 5 is done** (year in review, badges, "closing soon" email; see README.md "Status: milestone 5"). Badges are computed on every view, never stored. The digest is opt-in, and its unsubscribe link is signed, needs no sign-in and never acts on GET.
- **All milestones in BRIEF.md are built, and launch readiness is done in code** (see README.md "Status: launch readiness"). What's left is in `LAUNCH.md`, and most of it is Dimmu's (accounts, DNS, env vars, legal review). Step 0 (live scrape) is done. Ask Dimmu before starting anything new.

## Commands

```bash
pnpm dev                     # Next.js dev server
pnpm test                    # Vitest, parser tests run against fixtures/
pnpm build && pnpm test:e2e  # Playwright smoke tests at 360px (needs db:seed:fixtures; CHROMIUM_PATH optional)
pnpm typecheck && pnpm lint  # typecheck runs next typegen first (LayoutProps etc.)
pnpm db:seed:fixtures        # dev only: fixture productions into the database
pnpm scrape [sourceId] [--dry-run] [--limit N]
pnpm fixtures:refresh        # re-download the pages the parser tests use
pnpm moderation [hide|show <entryId>]  # reported reviews
pnpm launch:check <env file>  # validate a production environment (see LAUNCH.md)
```

## Conventions and gotchas

- **Prisma 7**: `prisma migrate dev` does not regenerate the client; run `pnpm db:generate` after it. Generator `prisma-client` outputs to `src/generated/prisma` (gitignored, created by `postinstall`). Import from `@/generated/prisma/client`. The client needs the `PrismaPg` driver adapter; use the shared instance in `src/lib/db.ts`. The datasource URL lives in `prisma.config.ts`, not in the schema.
- **Scrapers**: one adapter per source in `src/scrapers/adapters/`, implementing `SourceAdapter`. Parsers are pure functions (`parseList`, `parseDetail`) tested against saved HTML in `fixtures/`. Every new adapter needs fixtures and tests.
- **Scraping rules are non-negotiable**: facts only (titles, dates, stages, credits, ticket links, review links); never store marketing texts, press photos or review text; always go through `politeFetch` (robots.txt, 1 req/s per host, own User-Agent); never scrape lippu.fi.
- **Times**: store UTC; convert Helsinki wall-clock times with `helsinkiToUtc` in `src/scrapers/text.ts` (DST-safe). Display only through `src/lib/format.ts` (pinned to Europe/Helsinki; Vercel renders in UTC).
- **Cache Components is on.** Read `node_modules/next/dist/docs` before touching rendering. Detail pages use `ensureStatic = "navigation"` (real 404s); anything reading `searchParams` must not hide its content behind Suspense (invisible without JS). Time-dependent logic takes an explicit `asOf` from the cached query.
- **Auth**: Better Auth in `src/lib/auth.ts`; read the user with `getCurrentUser`/`requireUser` (`src/lib/session.ts`) only on dynamic pages and in actions. Never read the session on public pages: they are static. Personal sections are listed in `src/lib/auth-gate.ts` for the proxy redirect. Mutations are server actions in `src/lib/actions.ts`; after changing diary data call `updateTag(productionTag(slug))`.
- **Forms work without JavaScript** (plain server-action forms, `<details>`, radio chips). Keep it that way; `pnpm test:e2e` runs a no-JS project.
- **Critics vs blogs**: review links are split at render time by `reviewKind` (`src/lib/catalogue/review-kind.ts`): outlet name first (theatres often host the link on their own site), then domain; unknown outlets count as blogs. A newspaper shown under "Blogit" is fixed by adding it to `PRESS_NAMES`.
- **Current rows**: performances and credits whose `lastSeenAt` is older than the production's are stale; filter with `isCurrent` in `src/lib/catalogue/select.ts`.
- **Never hard-delete** scraped data; use `lastSeenAt`. Sources that only list upcoming performances set `performancesPartial` so unlisted later dates are not treated as cancelled.
- **Sources since 18 Oct 2026**: 13 (the six theatres plus Kansallisooppera ja -baletti, Tanssin talo, Zodiak, Q-teatteri, Teatteri Takomo, Teater Viirus, Teatteri Avoimet Ovet). Quirks in `fixtures/SOURCES.md`. A source that states its own category passes `typeHint` (wins over the classifier); a choreographer without a director means DANCE. Tanssin talo skips entries organised by Zodiak, which the zodiak source owns.
- **Theatre-site endpoints**: HKT performances come from `/wp-json/hkt/ticket-list/<post id>/` (its `timestamp` is Helsinki wall-clock posing as UTC: use `date` + `time`); Espoo's repertoire and performances both from `POST admin-ajax.php` (`get_dynamic_content`, `get_event_shows`). A listed page answering 404 is logged as missing, not failed. Free-text credit cells go through `personName` (drops "/ Company" and phrases). Dates without a year: use the printed weekday (`yearFromWeekday`) or month headings, never "next occurrence" guesses.
- **Engagement** (`src/lib/engagement/`): pure `yearInReview` and `badges` over `getEntryFacts`; badge texts live in the dictionaries under `badges.items`. A new badge needs an id in `BADGE_IDS`, a rule, and strings in all three languages.
- **Ops**: cron logic is pure and tested in `src/lib/ops/schedule.ts`; admins are `ADMIN_EMAILS`. Admin UI strings are Finnish-only by design.
- **Audience**: many users are 55–74. Light mode by default, body text 17–18px, high contrast, big tap targets, usable at 360px width.
- **Languages**: UI in Finnish (default), Swedish and English. Content stays in its original language.
- **Design**: printed theatre programme, not Netflix. No masks, curtains, gradients or shadows. The Aitio design system (https://claude.ai/artifact/P8RU9CHVFfvPRLkiQax68J) is the source: its tokens are in `src/app/globals.css` (`@theme`) and `src/lib/tokens.ts` (contrast-tested; change both together), its component classes (`ai-*`) in `globals.css`. Newsreader for titles, Atkinson Hyperlegible for UI with digits from Hanken Grotesk (Atkinson slashes its zero; see `src/app/fonts/README.md`); 16px is the floor for any text. Hide empty sections instead of showing empty states. Each theatre has its own poster colour (`THEATRE_TONES` in `src/lib/poster.ts`; a sixth ground, ink blue, was added for the sixth theatre): a new theatre needs an entry there. From 48rem the tabs move into the top bar; a page opts into the wide (1040px) column with `.ai-wide`, reading pages stay at the 640px measure. Type "Muu" (OTHER) is never shown to visitors (`typeLabel`); the front page groups shows under the day of their next performance (`groupByNextDay`). The about page text is in `src/lib/about.ts` and quotes code rules; keep it true. The specimen's "N esitystä jäljellä" is only shown for sources with a full schedule (`hasFullSchedule` in `src/scrapers/theatres.ts`).
- **Findability** (README "Status: findability"): search is in-memory over `getSearchIndex`; the time chips are links built with `filterQuery`, and a new filter key goes into `FILTER_KEYS`. Card running times come from `parseDuration`: when a source prints a new phrasing, add it to `duration.test.ts`. The premieres strip uses only a stated `premiereDate`.
- TypeScript strict, no `any`. Keep functions small.
- Commit messages: short imperative subject, body explaining why.
