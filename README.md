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
| 41 tests against real pages captured on 18 Oct 2026, plus a database integration test | `pnpm test` |

## Getting started

Requirements: Node 22+, pnpm, a PostgreSQL database (local, or a free Neon project).

```bash
pnpm install                       # also generates the Prisma client
cp .env.example .env               # then set DATABASE_URL
pnpm db:migrate --name init        # creates prisma/migrations and the tables
pnpm db:seed                       # inserts the six theatres
pnpm scrape --dry-run --limit 3    # see what would be saved, nothing is written
pnpm scrape                        # scrape both sources into the database
pnpm test                          # parser and pipeline tests
```

Run one source: `pnpm scrape kansallisteatteri` or `pnpm scrape svenska-teatern`.

Database integration test: create an empty database, migrate it, then run
`TEST_DATABASE_URL=postgresql://... pnpm test`. It wipes that database, so never point it at real data.

## When a theatre redesigns its website

1. `pnpm fixtures:refresh` downloads fresh copies of the pages the tests use.
2. `pnpm test` shows which selectors broke.
3. Fix the parser in `src/scrapers/adapters/`, update the expected values in the test, commit.

## Scraping rules

We store facts only: titles, dates, stages, credits, ticket links and links to reviews. No marketing texts, no press photos, no copied review text. Every request respects robots.txt, identifies itself (set `SCRAPER_USER_AGENT` with a contact address before going public) and waits at least a second between requests to the same host. Lippu.fi is deliberately not scraped.

## Known gaps and decisions for you

- **No migration committed.** The Prisma engine couldn't be downloaded in the sandbox this was built in. Run `pnpm db:migrate --name init` once on your machine and commit the generated `prisma/migrations` folder.
- **Person matching is by name.** Two different actors with the same name would merge. Fine for now; revisit with theatre person-page URLs as stable IDs.
- **Svenska Teatern's REST list includes about 85 shows back to 2022.** All are stored, because old productions are useful for diary entries ("I saw this in 2023"). Pages without performances just get no dates.
- **Kansallisteatteri subtitles** are shown per performance on their site; not parsed yet, so `subtitleLangs` is empty there.
- **Classifier** is keyword based; check `typeConfidence` below 0.6 manually until the admin override page exists.
- **The live fetch path has not run end-to-end** from the build environment (its network was restricted). Parsers are tested against real pages, but do one `pnpm scrape --dry-run --limit 3` first.

## Next: milestone 2

Read-only site: "Ohjelmassa" front page, production, theatre and person pages, i18n (fi/sv/en), PWA manifest, sitemap. See `BRIEF.md` section 7.
