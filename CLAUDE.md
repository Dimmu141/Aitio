# Aitio: notes for Claude Code

Aitio is a mobile-first website for logging, rating and discovering theatre in Finland (Letterboxd mechanics, Untappd-style check-ins, Show-Score-style tags). The owner is Dimmu: he builds with Next.js, TypeScript, Prisma, PostgreSQL and Vercel, and wants a sparring partner, not a yes-man. Push back when something in the plan is wrong.

Read `BRIEF.md` before starting new work. It holds the product decisions, data sources, scraping rules and milestones.

## Current status

- **Milestone 1 is done** (data layer + two scrapers, 41 tests). See README.md for what exists.
- **Milestone 1 was built in a sandbox without internet access to the theatre sites or Prisma's engine downloads.** So on first run here:
  1. `pnpm install`
  2. `cp .env.example .env` and set `DATABASE_URL`
  3. `pnpm db:migrate --name init` (no migration was committed yet; commit the generated `prisma/migrations` folder)
  4. `pnpm db:seed`
  5. `pnpm scrape --dry-run --limit 3`: the first ever run against the live sites. Fix any parser problems before scraping fully.
- **Milestone 2 is in progress**: pages, components and design tokens exist (see README.md). Remaining: sv/en UI, cache purge after scraping, share images, `Credit.roleText`.
- **Design system**: https://claude.ai/artifact/P8RU9CHVFfvPRLkiQax68J holds the tokens, component rules and the production page specimen. `src/app/globals.css` mirrors its tokens; change both together.

## Commands

```bash
pnpm dev                     # Next.js dev server
pnpm test                    # Vitest, parser tests run against fixtures/
pnpm typecheck && pnpm lint
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
