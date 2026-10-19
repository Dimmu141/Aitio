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

## Status: milestone 4 (all six theatres, cron, monitoring, admin)

### Adapters

| Source | How | Quirks the fixtures taught us |
|---|---|---|
| Kansallisteatteri | HTML | per-performance subtitles still not parsed (empty in every capture) |
| Svenska Teatern | REST list + HTML | old productions kept for diary entries |
| HKT + Lilla Teatern | HTML + `/wp-json/hkt/ticket-list/<id>/` | performances only come from the JSON; its `timestamp` is Helsinki time posing as UTC, so we use `date` + `time` |
| Ryhmäteatteri | REST `artist` + HTML | FI and EN posts per show (keep FI); subtitles only on some weekdays; one production on right now |
| KOM-teatteri | repertoire page + production pages + calendar | hand-edited pages; page dates merged with the calendar's tickets and venues |
| Espoon Teatteri | HTML + `admin-ajax.php` (POST) | only the next few performances are ever public; the year comes from the printed weekday; `page/2` repeats page 1 |

Every adapter has fixtures and tests (`src/scrapers/adapters/*.test.ts`); `fixtures/SOURCES.md` says where each capture came from.

### Scheduling and monitoring

- **Vercel Cron**: one job per theatre (`vercel.json`), daily 03:00–03:50 UTC, calling `/api/cron/scrape/<source>` with `Authorization: Bearer $CRON_SECRET`, up to 300 s each. `/api/cron/scrape/next` runs whichever source is most overdue, for a plan with fewer cron jobs.
- **Once a day** per source even if a cron retries; runs killed by the time limit are closed as failed; a successful run refreshes the cached catalogue.
- **Alerts**: a failed or timed-out run, or one that lost over a quarter of its detail pages, emails `ADMIN_EMAILS`.
- **`/yllapito`** (admins only, Finnish): health and history per source, a type-override list for productions the classifier was unsure about, and the moderation queue.

### Data model changes

- `Performance.subtitleLangs`: subtitles at that performance only (Ryhmäteatteri's Wednesdays and Fridays); `Production.subtitleLangs` now means every performance. The production page lists them per date.
- Partial performance lists (`performancesPartial`): for Espoo, a stored performance after the last listed one stays current instead of looking cancelled.
- Critic links carry their publication date where the theatre gives it.
- Languages: Spanish, Arabic, Latvian, Estonian, French, German, and `zxx` for wordless shows.

### Configuration (new)

| Variable | What for |
|---|---|
| `CRON_SECRET` | Vercel sends it to the cron routes; set it in the project's environment variables |
| `ADMIN_EMAILS` | comma-separated accounts that see `/yllapito` and get scrape alerts |

### Known gaps

- **Not one live scrape yet.** The new fixtures were captured through Firecrawl because this environment blocks the theatre sites, and Firecrawl returns pages after JavaScript ran. Before trusting the cron: `pnpm fixtures:refresh && pnpm test`, then `pnpm scrape --dry-run --limit 3` per source. HKT and Espoo depend on endpoints their own scripts call (`/wp-json/hkt/ticket-list/`, `admin-ajax.php`); those requests are verified only through the captured data.
- **Vercel plan limits not confirmed**: I could not find the current cron-count and duration limits in Vercel's docs from here. If six cron jobs or 300 s are not allowed on your plan, switch `vercel.json` to one `/api/cron/scrape/next` job, run several times a day if possible.
- **Espoo shows only its next few performances**, so its productions list only those, with the theatre's own ticket link for the rest.
- **Kansallisteatteri subtitles** still unknown; the subtitle filter stays off, but the per-performance model it needs now exists.
- **No production type for circus, puppetry or game performances**; they come out as OTHER or a guessed PLAY and wait in the admin's type list.
- **Admins are an environment variable**, with no audit log of overrides or moderation decisions.
- **The admin page answers non-admins with HTTP 200** and the not-found page (the status is sent before the page decides); none of its content is sent, which the e2e tests check.

## Status: milestone 5 (engagement)

### Year in review

- `/paivakirja/<year>` (`/sv/dagbok/<year>`, `/en/diary/<year>`), linked from each year heading in the diary. Personal only, like the diary.
- Shows, theatres, average rating (from two ratings up), reviews written, productions and rewatches, a month-by-month bar chart (one sentence per month for screen readers), highest ratings, theatres, performers seen in two or more productions, tags, genres, languages, and the first and last show of the year.
- Computed by the pure `yearInReview` (`src/lib/engagement/year.ts`) over `getEntryFacts`.

### Badges

- Twelve badges (`src/lib/engagement/badges.ts`), each dated by the entry that earned it, and counting badges show progress ("7 / 10"). They are listed at the bottom of the diary, with the locked ones behind a `<details>`.
- **Computed on every view, never stored**: deleting an entry takes its badge away, and a new rule applies to old diaries with no backfill.
- "Just in time" (seen on the final day) counts only once that day is in the past, because a run's last known date can still move. "The whole city" compares against the number of theatres in the database, not a hard-coded six.

### "Closing soon" email

- Opt-in checkbox in the settings (`#kooste`), also linked from the front page's "Viimeiset esitykset" box. The email uses the language of the page where the user opted in.
- Vercel Cron `/api/cron/digest` on Thursdays at 05:00 UTC: productions whose last known performance is within 14 days, minus what the user has already logged, closing first. Plain text, with production links. Nothing is sent when nothing is closing.
- **Idempotent**: `User.digestSentAt` means a retry within six days sends nothing; a failed send stays due. Up to 200 users per run, spaced for Resend's default rate of 2 requests per second.
- **Unsubscribing works without signing in**: the email links to `/peru-tilaus?u=…&s=…`, signed with an HMAC of the user id under `BETTER_AUTH_SECRET`. The page has a button, so link scanners can't unsubscribe anyone. `List-Unsubscribe` and `List-Unsubscribe-Post` point at `/api/digest/unsubscribe` for one-click unsubscribe in mail clients (RFC 8058).
- The data export includes the digest settings.

### Known gaps

- **Over 200 subscribers** need more than one run a week: add a second cron job, or move to Resend's batch API.
- **The email lists every closing production in the region**, not just the user's theatres. With six theatres that's a handful; with more, it should follow the theatres in the diary.
- **No bounce or complaint handling**: a hard-bouncing address keeps getting tried each week. Resend webhooks can switch `digestOptIn` off.
- **Seven cron jobs now**: the plan-limit question from milestone 4 still stands.
- **The year review is private.** A shareable version would need public profiles, which is a privacy decision for later.
- **The Resend sender address** (`EMAIL_FROM`) is the sign-in one; a separate `uutiset@` address would protect sign-in deliverability if the digest ever gets marked as spam.

## Status: launch readiness

The step-by-step launch is in **`LAUNCH.md`**. What the code now has for it:

- **Privacy policy** at `/tietosuoja` (`/sv/dataskydd`, `/en/privacy`), linked from the footer and the sign-in page. It covers articles 13 and 14 of the GDPR, including the performers whose names come from theatre websites. The retention numbers come from the code's own constants (`SESSION_DAYS`, `MAGIC_LINK_MINUTES`, `RATE_LIMIT_RETENTION_DAYS`, `BACKUP_DAYS`), so the text can't drift from what the code does. The controller comes from `PRIVACY_CONTROLLER` and `PRIVACY_EMAIL`.
- **Email provider: Brevo** (EU), chosen by `BREVO_API_KEY`; Resend still works. `/api/email/events` takes Brevo's webhook (bearer `EMAIL_WEBHOOK_SECRET`): a hard bounce, spam complaint, invalid or blocked address switches that user's digest off.
- **Daily cleanup** (`/api/cron/cleanup`): expired sessions (with IP and browser), sign-in tokens, and rate-limit rows older than two days (their keys are email and IP addresses). Before this they were kept forever.
- **Region**: functions run in Frankfurt (`"regions": ["fra1"]`) next to the database, instead of Vercel's default in Washington.
- **Security headers**: nosniff, frame-ancestors none / X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS, no `X-Powered-By`.
- **`pnpm launch:check <env file>`**: validates a production environment (secrets long enough, https site URL, an email provider, privacy contact, a real scraper contact, no dev email log).

### Known gaps

- **Still no live scrape**: step 0 in `LAUNCH.md`.
- **No full Content-Security-Policy**: Next's inline scripts would need per-request nonces, which would make every static page dynamic. The headers above stop clickjacking and MIME sniffing; XSS protection rests on React escaping.
- **Brevo and `List-Unsubscribe`**: Brevo's API documentation says it doesn't accept standard headers, so our one-click unsubscribe header might be dropped or replaced. Step 2 of `LAUNCH.md` says how to check.
- **The privacy policy is not legal advice**; have it read before launch.
- **No error tracking** beyond Vercel's logs and the scrape alerts.

## Status: findability (18 Oct 2026)

After comparing Aitio with foreign listing sites (Official London Theatre, Berlin Bühnen, TodayTix, Show-Score):

- **Search** at `/haku` (`/sv/sok`, `/en/search`), a fourth tab. It runs in memory over a cached index (`getSearchIndex`, `src/lib/catalogue/search.ts`): every word must match, accents are forgiven both ways, playing shows rank before past ones. People are listed only with current credits, so no result leads to a 404. Result pages are `noindex`.
- **Time chips** on the front page (Tänään, Huomenna, Viikonloppuna, 7 päivää): plain links outside the filter panel that keep the other choices (`filterQuery`). The weekend is Friday to Sunday, or what's left of it (`src/lib/catalogue/when.ts`). With a chip, a card sits under its first performance on those days.
- **"Seurattavissa englanniksi"** (understandable in English) is a choice in the language filter: spoken in English, wordless (`zxx`), or English subtitles within the window.
- **Running time and intervals** on cards, parsed from the theatre's own text by `parseDuration` (tested against every text in the live data). The production page keeps the original text.
- **Premieres** ("Ensi-illat") above the programme: only the date the theatre states (`premiereDate`), never the first performance we happened to store. Four rows, the rest behind a toggle.
- Cards say the language when it isn't Finnish, and the subtitles.

### Known gaps

- **Premiere dates** come from HKT, Svenska Teatern, Espoo, KOM, Q, Takomo, Viirus, Zodiak, Kansallisteatteri (the "Kantaesitys"/"Ensi-ilta" line or the row marked Ensi-ilta) and Tanssin talo (only when its schedule labels a date "Ensi-ilta", which is rare). The opera states none, so its openings are missing from the strip. Once stated, a premiere is kept even when a later scrape no longer prints it (`normalise.ts`), since Tanssin talo's label and the row fallback disappear after the night.
- **Espoo** prints no running time we parse.

## Status: want to see and calendar (18 Oct 2026)

- **"Haluan nähdä" list** (`/haluan-nahda`, `/sv/vill-se`, `/en/want-to-see`; `WatchItem` in the schema, `src/lib/diary/watchlist.ts`). The button on a show's page is a server-action form, so the static page never reads the session. Signed in, it adds in one tap. Signed out, it goes through sign-in to the list page, which asks once more: a GET after the sign-in link must not change anything. An item leaves the list when the show is logged as seen (`saveEntry`). The list is private, part of the data export, and deleted with the account.
- **The Thursday email** puts closing shows from the user's list first, with their own subject line. It is still opt-in; the list page suggests it when it's off.
- **"Kalenteriin"** under every performance: `/api/calendar?show=<slug>&at=<ISO>&lang=fi` returns an `.ics` file (`src/lib/ics.ts`: UTC times, escaping, 75-octet folding). The end time is set only when the theatre states the running time.

### Known gaps

- **No reminder for shows on the list that aren't closing.** The email covers "closing soon" only; "your saved show opens next week" would need its own rule.
- **The button doesn't know you've already saved the show**, because the page is static. Saving twice is harmless and lands on the list.
