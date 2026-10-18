# Aitio: notes for Claude Code

Aitio is a mobile-first website for logging, rating and discovering theatre in Finland (Letterboxd mechanics, Untappd-style check-ins, Show-Score-style tags). The owner is Dimmu: he builds with Next.js, TypeScript, Prisma, PostgreSQL and Vercel, and wants a sparring partner, not a yes-man. Push back when something in the plan is wrong.

Read `BRIEF.md` before starting new work. It holds the product decisions, data sources, scraping rules and milestones.

## Current status

- **Milestone 1 is done** (data layer + two scrapers, 43 tests). See README.md for what exists.
- **Milestone 1 first-run is done** except the live scrape: migration committed (`prisma/migrations`), seed and integration tests pass on PostgreSQL 16. `pnpm db:seed:fixtures` loads the two fixture productions for local page development.
- **Still open:** `pnpm scrape --dry-run --limit 3` has never run against the live sites. Cloud sessions get a proxy 403 for the theatre domains unless they are allowed in the environment's network settings. Fix any parser problems before scraping fully.
- **Next: milestone 2**, the read-only site (BRIEF.md section 7). Decisions already agreed with Dimmu:
  - Finnish URLs at the root, `/sv/` and `/en/` prefixed with translated path segments (next-intl `pathnames`); fall back to Finnish segments everywhere if next-intl misbehaves on Next 16.
  - Hide "Merkitse nähdyksi" until auth exists (milestone 3); no dead buttons.
  - Index past productions and list them in the sitemap with a "Esitetty <year>" label, but keep them out of "Ohjelmassa".
  - Parse Kansallisteatteri per-performance subtitles (with a fixture) before shipping the subtitle filter.
  - Format all times with an explicit `timeZone: "Europe/Helsinki"` (Vercel renders in UTC).

## Commands

```bash
pnpm dev                     # Next.js dev server
pnpm test                    # Vitest, parser tests run against fixtures/
pnpm typecheck && pnpm lint  # typecheck runs next typegen first (LayoutProps etc.)
pnpm db:seed:fixtures        # dev only: fixture productions into the database
pnpm scrape [sourceId] [--dry-run] [--limit N]
pnpm fixtures:refresh        # re-download the pages the parser tests use
```

## Conventions and gotchas

- **Prisma 7**: generator `prisma-client` outputs to `src/generated/prisma` (gitignored, created by `postinstall`). Import from `@/generated/prisma/client`. The client needs the `PrismaPg` driver adapter; use the shared instance in `src/lib/db.ts`. The datasource URL lives in `prisma.config.ts`, not in the schema.
- **Scrapers**: one adapter per source in `src/scrapers/adapters/`, implementing `SourceAdapter`. Parsers are pure functions (`parseList`, `parseDetail`) tested against saved HTML in `fixtures/`. Every new adapter needs fixtures and tests.
- **Scraping rules are non-negotiable**: facts only (titles, dates, stages, credits, ticket links, review links); never store marketing texts, press photos or review text; always go through `politeFetch` (robots.txt, 1 req/s per host, own User-Agent); never scrape lippu.fi.
- **Times**: store UTC; convert Helsinki wall-clock times with `helsinkiToUtc` in `src/scrapers/text.ts` (DST-safe).
- **Never hard-delete** scraped data; use `lastSeenAt`.
- **Audience**: many users are 55–74. Light mode by default, body text 17–18px, high contrast, big tap targets, usable at 360px width.
- **Languages**: UI in Finnish (default), Swedish and English. Content stays in its original language.
- **Design**: printed theatre programme, not Netflix. Warm off-white, serif titles, sans UI, one accent colour. No masks, curtains or gradients.
- TypeScript strict, no `any`. Keep functions small.
- Commit messages: short imperative subject, body explaining why.
