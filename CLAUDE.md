# Aitio: notes for Claude Code

Aitio is a mobile-first website for logging, rating and discovering theatre in Finland (Letterboxd mechanics, Untappd-style check-ins, Show-Score-style tags). The owner is Dimmu: he builds with Next.js, TypeScript, Prisma, PostgreSQL and Vercel, and wants a sparring partner, not a yes-man. Push back when something in the plan is wrong.

Read `BRIEF.md` before starting new work. It holds the product decisions, data sources, scraping rules and milestones.

## Current status

- **Milestone 1 is done** (data layer + two scrapers, 43 tests). See README.md for what exists.
- **Milestone 1 first-run is done** except the live scrape: migration committed (`prisma/migrations`), seed and integration tests pass on PostgreSQL 16. `pnpm db:seed:fixtures` loads the two fixture productions for local page development.
- **Still open:** `pnpm scrape --dry-run --limit 3` has never run against the live sites. Cloud sessions get a proxy 403 for the theatre domains unless they are allowed in the environment's network settings. Fix any parser problems before scraping fully.
- **Milestone 2 is done** (read-only site, see README.md "Status: milestone 2" and its known gaps). Decisions agreed with Dimmu and now built:
  - Finnish URLs at the root, `/sv/` and `/en/` with translated segments, via `src/proxy.ts` and `src/i18n/paths.ts` (not next-intl; see README for why).
  - "Merkitse nähdyksi" is hidden until auth exists (milestone 3); no dead buttons.
  - Past productions are indexed and in the sitemap with an "Esitetty <year>" label, but stay out of "Ohjelmassa".
  - The subtitle filter stays off until Kansallisteatteri per-performance subtitles are parsed from a real fixture.
- **Milestone 3 is done** (users and diary, see README.md "Status: milestone 3" and its known gaps). Decisions agreed with Dimmu:
  - Better Auth instead of Auth.js (BRIEF.md section 2 updated), email magic links only, no passwords or social login.
  - Reviews are public by default with a visible opt-out checkbox; ratings and tags always count anonymously.
- **Milestone 4 is done** (all six adapters, Vercel Cron, monitoring, `/yllapito`; see README.md "Status: milestone 4"). The new fixtures came from Firecrawl (post-JavaScript), so **the first session with network access must run `pnpm fixtures:refresh && pnpm test` and a dry-run per source** before the cron is trusted.
- **Launch decisions made:** Brevo (EU) for email, Neon in Frankfurt with Vercel functions in `fra1`, and the Hobby plan, which is enough (100 cron jobs, once a day, 300 s). The privacy policy lives in `src/lib/privacy.ts` and quotes the retention constants; when you change retention, data collected, or a provider, update it and `POLICY_DATE`.
- **Milestone 5 is done** (year in review, badges, "closing soon" email; see README.md "Status: milestone 5"). Badges are computed on every view, never stored. The digest is opt-in, and its unsubscribe link is signed, needs no sign-in and never acts on GET.
- **All milestones in BRIEF.md are built, and launch readiness is done in code** (see README.md "Status: launch readiness"). What's left is in `LAUNCH.md`, and most of it is Dimmu's (accounts, DNS, env vars, legal review). The live scrape (step 0) is still blocking. Ask Dimmu before starting anything new.

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
- **Current rows**: performances and credits whose `lastSeenAt` is older than the production's are stale; filter with `isCurrent` in `src/lib/catalogue/select.ts`.
- **Never hard-delete** scraped data; use `lastSeenAt`. Sources that only list upcoming performances set `performancesPartial` so unlisted later dates are not treated as cancelled.
- **Theatre-site endpoints**: HKT performances come from `/wp-json/hkt/ticket-list/<post id>/` (its `timestamp` is Helsinki wall-clock posing as UTC: use `date` + `time`); Espoo's from `POST admin-ajax.php`. Dates without a year: use the printed weekday (`yearFromWeekday`) or month headings, never "next occurrence" guesses.
- **Engagement** (`src/lib/engagement/`): pure `yearInReview` and `badges` over `getEntryFacts`; badge texts live in the dictionaries under `badges.items`. A new badge needs an id in `BADGE_IDS`, a rule, and strings in all three languages.
- **Ops**: cron logic is pure and tested in `src/lib/ops/schedule.ts`; admins are `ADMIN_EMAILS`. Admin UI strings are Finnish-only by design.
- **Audience**: many users are 55–74. Light mode by default, body text 17–18px, high contrast, big tap targets, usable at 360px width.
- **Languages**: UI in Finnish (default), Swedish and English. Content stays in its original language.
- **Design**: printed theatre programme, not Netflix. Warm off-white, serif titles, sans UI, one accent colour. No masks, curtains or gradients.
- TypeScript strict, no `any`. Keep functions small.
- Commit messages: short imperative subject, body explaining why.
