# Aitio: project brief for a Finnish theatre diary and review site

You are my coding partner on a new project. Read this whole brief before writing any code. When something here is ambiguous, ask me instead of guessing. When you finish a milestone, stop, summarise what you built, list what is still rough, and wait for me.

## 1. What we are building

A mobile-first website (installable as a PWA) where people in Finland can:

- see what plays are on now in Helsinki-area theatres,
- log the performances they have seen in a personal diary,
- rate them and add short reviews and tags,
- browse production, theatre and person (actor, director) pages.

Think "Letterboxd for Finnish theatre", with Untappd-style check-ins and Show-Score-style tags. It is NOT a Rotten Tomatoes clone: Finnish productions get only 1–3 professional reviews, so we never compute a critic score. Critics appear as outbound links only.

Primary audience: regular theatregoers, many aged 55–74. Design for them: light mode by default, large readable text (body 17–18px), high contrast, big tap targets, simple flows.

Languages: Finnish (default), Swedish and English. Content (play titles, credits) stays in its original language; UI strings are translated.

## 2. Stack (do not substitute without asking)

- Next.js (App Router) + TypeScript, strict mode
- Tailwind CSS
- Prisma + PostgreSQL (Neon or local Postgres in dev)
- Deployed on Vercel; scrapers run as Vercel Cron jobs calling route handlers (or a separate Node script I can run locally)
- Cheerio for HTML parsing; plain `fetch` for HTTP
- Zod for validating every scraped record before it touches the database
- Vitest for tests
- next-intl (or equivalent) for fi / sv / en
- Auth: Auth.js with email magic links (milestone 3, not now)

## 3. Data model (starting point, improve it if you see problems)

- `Theatre`: name, slug, city, website, ticketing provider
- `Venue` / `Stage`: belongs to Theatre (e.g. "Suuri näyttämö", "AMOS-scenen")
- `Production`: title, slug, theatre, stage, type (`PLAY | MUSICAL | OPERA | DANCE | CONCERT | STANDUP | TALK | OTHER`), languages, subtitle languages, premiere date, run start, run end, duration text, source URL, external IDs, `typeConfidence`, `typeOverride`, `lastSeenAt`
- `Performance`: production, start datetime (Europe/Helsinki stored as UTC), stage, ticket URL
- `Person`: name, slug
- `Credit`: person, production, role (`DIRECTOR | WRITER | COMPOSER | CAST | ...`), character name optional
- `CriticReview`: production, outlet, URL, published date (links only, never copied text)
- `User`, `DiaryEntry` (user, production, optional performance, seen date, rating 0.5–5 in half steps, short review, tags, rewatch flag), `Tag`
- `ScrapeRun`: source, started, finished, items found, items changed, errors (for monitoring)

Reviews belong to the Production. A DiaryEntry can optionally point to the specific Performance, because cast changes and individual nights matter in theatre.

## 4. Data sources (verified by a manual test on 18 Oct 2026; re-verify selectors against the live pages yourself)

Write one adapter per source behind a common interface:

```ts
interface SourceAdapter {
  id: string;
  fetchProductions(): Promise<RawProduction[]>;
  fetchProductionDetail(ref: RawProduction): Promise<RawProductionDetail>;
}
```

Adapters return raw data; a separate normaliser maps it to the Prisma model and upserts by `(theatreId, externalId or slug)`.

| Theatre | Platform | How to get data | Tickets |
|---|---|---|---|
| Svenska Teatern | WordPress | REST: `https://svenskateatern.fi/wp-json/wp/v2/shows?per_page=100&_fields=id,title,link,modified`. Dates and credits are NOT in the REST response (ACF empty): read them from each production page HTML. The list includes past shows, concerts and talks: filter out productions without upcoming performances and classify type. | Tixly: `biljetter.svenskateatern.fi/sv/buyingflow/tickets/{eventId}/{performanceId}/` |
| Ryhmäteatteri | WordPress | REST: `https://www.ryhmateatteri.fi/wp-json/wp/v2/artist?per_page=100&_fields=id,title,link,modified` (returns FI and EN versions of the same production: dedupe) | Tiketti |
| Kansallisteatteri | Drupal 11 | List: `https://www.kansallisteatteri.fi/ohjelmisto/esitykset-a-o`. Production pages at `/esitys/{slug}`. Each performance has a Lippu.fi link whose `aria-label` contains the date, e.g. `"Osta liput Viidakon villit naiset perjantai 23.10. Lippu.fi-verkkokaupassa"`. The year is missing: infer it (next occurrence of that day and month on or after the run start). | Lippu.fi |
| Helsingin Kaupunginteatteri (incl. Lilla Teatern) | WordPress (productions not in REST) | HTML: `https://hkt.fi/esitykset/` and `/esitykset/{slug}/`. Pages contain stage, premiere, run dates, writer, director, full cast, duration, language and upcoming dates. | Lippu.fi (`erid` param) |
| KOM-teatteri | WordPress | Productions are pages under `https://kom-teatteri.fi/ohjelmisto/`; try REST `wp/v2/pages` filtered by parent, else HTML | Lippu.fi |
| Espoon Teatteri | WordPress | HTML: `https://espoonteatteri.fi/ohjelmisto/` | `espoonteatteri.lippu.fi` white-label shop |

None of these sites output schema.org `Event` JSON-LD (only Yoast WebPage/Breadcrumb), so parse HTML with stable selectors.

Not in scope now: Lippu.fi sitemaps or event pages. I will ask Eventim about their affiliate programme first. Do not scrape lippu.fi.

## 5. Scraping rules (non-negotiable)

- Respect each site's robots.txt (checked: none of the paths above are disallowed for generic bots, but check in code too).
- Identify ourselves: `User-Agent: AitioBot/0.1 (+https://<our-domain>/bot; contact email)`.
- At most 1 request per second per host, run at most once a day, cache responses.
- Store FACTS only: titles, dates, venues, credits, ticket URLs, source URLs. Never copy marketing descriptions or press photos into our database or pages. We write our own one-line summaries later, or link out.
- Save raw HTML/JSON fixtures of every source in `fixtures/` and write parser tests against them, so a site redesign breaks a test instead of silently returning nothing.
- Monitoring: record every run in `ScrapeRun`. If a source returns 0 items, or 50% fewer than last run, mark it as failed and do NOT delete existing data.
- Never hard-delete productions; mark them `lastSeenAt` and let them age out.

## 6. Classification

Listings mix plays with concerts, stand-up, talks and club nights. Implement a rule-based classifier first (keywords in title, stage name, source category, e.g. "stand-up", "konsertti", "runoilta", "samtal", "Lavaklubi"). Store `typeConfidence`. Allow a manual `typeOverride` via a simple admin page later. No LLM in the pipeline for now.

## 7. Pages (milestone 2)

All pages server-rendered for SEO, with proper `<title>`, meta description, canonical URL, OpenGraph, and our own schema.org `TheaterEvent` / `Event` JSON-LD on production pages.

- `/` "Ohjelmassa": productions with performances in the next 14 days, filters for city, type, language and subtitles, plus a "Viimeiset esitykset" (closing within 14 days) section.
- `/esitys/[slug]`: the production page. Layout:
  1. Typographic poster block (title in a serif on a coloured card; no press images), title, theatre, stage, type, duration, language and subtitle badges
  2. Run progress bar from premiere to last performance, plus the next performance date
  3. Two buttons: "Merkitse nähdyksi" (primary) and "Osta liput" (secondary, outbound)
  4. Audience section: rating histogram and tag counts. Hide the average until there are 10 ratings.
  5. "Kriitikot": outbound links only
  6. "Tekijät": director, writer, cast linking to person pages
- `/teatteri/[slug]`: theatre page with current productions and stages
- `/henkilo/[slug]`: person page listing all their productions across theatres
- `sitemap.xml` and `robots.txt` for our own site
- PWA manifest and icons so the site can be added to the home screen

Design direction: printed theatre programme, not Netflix. Warm off-white background, serif for titles, clean sans for UI, one accent colour. No comedy/tragedy masks, no velvet curtains, no gradients. Fully usable at 360px width.

## 8. Milestones

Do them in order. Stop after each one.

1. **Scaffold + data layer**: project setup, Prisma schema and migration, seed of the six theatres, adapter interface, normaliser, the Svenska Teatern (REST) and Kansallisteatteri (HTML) adapters with fixture-based tests, a CLI script `pnpm scrape [sourceId]` that prints what it would upsert (dry run flag) and then upserts.
2. **Read-only site**: the pages in section 7 using the data from milestone 1, i18n skeleton, PWA manifest, sitemap.
3. **Users and diary**: auth, "Merkitse nähdyksi" flow (two taps on mobile: pick date, optional rating), diary page as ticket-stub cards, ratings, tags, short reviews, simple moderation (report button, rate limits).
4. **Remaining adapters**: HKT, Ryhmäteatteri, KOM, Espoo, plus Vercel Cron and the ScrapeRun monitoring view.
5. **Engagement**: year-in-review page, badges, "closing soon" email digest.

## 9. How I want you to work

- Start milestone 1 only. Before coding, show me the Prisma schema and the folder structure and wait for my OK.
- Keep functions small and typed; no `any`.
- Every adapter ships with fixtures and tests.
- Write a short README section per milestone: how to run, what is done, known gaps.
- Tell me when you are unsure whether a scraped value is right. The values I listed above came from a quick AI-assisted check and must be confirmed against the live HTML.
