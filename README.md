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

## Milestone 2 (in progress): the read-only site

The look follows the Aitio design system (https://claude.ai/artifact/P8RU9CHVFfvPRLkiQax68J): its tokens live in `src/app/globals.css` as Tailwind theme values (`bg-paper`, `text-ink-muted`, `text-display`, `min-h-tap`…). Tailwind's default palette is switched off on purpose.

| Route | What |
|---|---|
| `/` | "Ohjelmassa": productions with performances in the next 14 days, "Viimeiset esitykset", filters as URL parameters (`?kaupunki=&tyyppi=&kieli=&tekstitys=`) |
| `/esitys/[slug]` | production page: poster, badges, run status, dates with ticket links, critic links, credits, `TheaterEvent` JSON-LD |
| `/teatterit`, `/teatteri/[slug]` | theatres and what is on at each |
| `/henkilo/[slug]` | everything a person has done, newest first |
| `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `/icon` | SEO and PWA basics |

Data is read through `src/lib/queries.ts`, cached for hours (`use cache`, tag `productions`). Without `DATABASE_URL`, or if the database is down, pages show a short notice instead of failing, so a Vercel build never needs the database. Set `NEXT_PUBLIC_SITE_URL` in production for canonical URLs.

Still to do in milestone 2: Swedish and English UI (strings are already in `src/i18n/fi.ts`), purge the cache after a scrape (`revalidateTag("productions")`), share images per production.

Known gap: `Credit` stores only the role enum, so "Lavastus", "Puvut" and "Valot" all show as "Suunnittelu". Adding `Credit.roleText` fixes it; best done before the first migration.
