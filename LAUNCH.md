# Launch runbook

Do the steps in order. Each one ends with a check, so you know it worked before moving on.
Everything here is decided except the items marked **you decide**.

## 0. Verify the scrapers against the live sites ✓ done 18 Oct 2026

Done in a cloud session; results and fixes are in `fixtures/SOURCES.md`. Repeat it whenever
a source starts failing in `/yllapito`. Cloud sessions are blocked from the theatre sites
unless the environment allows them, and Node's fetch needs `NODE_USE_ENV_PROXY=1` there.
In the environment settings, under
Network access, add these six hosts to the allowed domains (keep "Allow package
managers" ticked; see https://code.claude.com/docs/en/cloud-environments#network-access):

```
www.kansallisteatteri.fi  svenskateatern.fi  hkt.fi
www.ryhmateatteri.fi      kom-teatteri.fi    espoonteatteri.fi
```

Then, in a new session or on your own machine:

```bash
pnpm fixtures:refresh && pnpm test        # parsers against today's HTML
for s in kansallisteatteri svenska-teatern hkt ryhmateatteri kom-teatteri espoon-teatteri; do
  pnpm scrape $s --dry-run --limit 3
done
```

**Check:** tests stay green and every dry run prints productions with dates, stages and
credits that match the theatre's own page. The HKT, Ryhmäteatteri, KOM and Espoo fixtures
were captured after JavaScript ran (Firecrawl), so expect at least one parser fix.

## 1. Database: Neon, Frankfurt ✓ done 18 Oct 2026

Neon project **aitio** (`bold-sound-80975446`) in your personal Neon organisation, AWS
eu-central-1, PostgreSQL 17, database `aitio`, owner role `aitio_owner`. All six migrations
are applied and recorded in `_prisma_migrations` with Prisma's own checksums (so
`prisma migrate deploy` sees them as done), and the 6 theatres and 12 tags are seeded. The
schema was verified identical to the local one. It was created through the Neon connector,
not the Vercel Marketplace, so `DATABASE_URL` must be set in Vercel by hand (use the
**pooled** connection string). Free plan restore window: 6 hours, within `BACKUP_DAYS`.

What follows is how it was done, for a rebuild:


- Vercel dashboard → Storage → Marketplace → Neon. Pick region **AWS eu-central-1
  (Frankfurt)**: it matches `"regions": ["fra1"]` in `vercel.json` and what the privacy policy says.
- The integration sets `DATABASE_URL`. Use the **pooled** connection string with `sslmode=require`.
- Run the migrations and the theatre seed once:
  `DATABASE_URL=… pnpm prisma migrate deploy && DATABASE_URL=… pnpm db:seed`
  (never `db:seed:fixtures` in production).
- **Check:** the point-in-time restore window on your Neon plan. The privacy policy says
  deleted data is gone from backups within `BACKUP_DAYS` (7) days; change `src/lib/privacy.ts`
  if your plan keeps it longer.

## 2. Email: Brevo ✓ domain authenticated 18 Oct 2026

Domain `omaaitio.fi` is authenticated in Brevo (brevo-code TXT, DKIM `brevo1`/`brevo2`
CNAMEs, one merged SPF `v=spf1 mx include:_spf.nordweb.fi include:spf.brevo.com ~all`,
DMARC `p=none` reporting to Brevo). Sender `kirjaudu@omaaitio.fi` is active, and the
webhook posts to `https://omaaitio.fi/api/email/events`. DNS is at Nordweb (the
registrar); keep its MX record, and never add a second SPF or DMARC record: edit the
existing one. Still to do: the Gmail "Show original" check in item 5 below.

Why Brevo: an EU company (France), data hosted in France and Germany, 300 emails a day
free, and it allows both sign-in emails and the opt-in weekly digest. Scaleway TEM keeps
everything inside the EU too, but its policy allows transactional email only, and the
digest is a newsletter. Resend works as a fallback and is still supported (`RESEND_API_KEY`).

1. Create the account. Add and **authenticate the domain** `aitio.fi`: SPF, DKIM and a
   DMARC record (`v=DMARC1; p=none; rua=mailto:…` to start, tighten later).
2. Create the sender `kirjaudu@aitio.fi` (`EMAIL_FROM="Aitio <kirjaudu@aitio.fi>"`).
3. API key → `BREVO_API_KEY` in Vercel (Production only).
4. Transactional → Settings → Webhooks: URL `https://aitio.fi/api/email/events`, events
   *Hard bounce, Spam, Invalid email, Blocked, Unsubscribed*, authentication *Bearer token* =
   `EMAIL_WEBHOOK_SECRET`.
5. **Check:** sign in on production with your own Gmail address and open
   "Show original": SPF, DKIM and DMARC say PASS. Opt in to the digest, trigger it once
   (step 5), and check that Gmail shows an "Unsubscribe" link next to the sender. Brevo
   documents custom headers but says standard headers aren't supported, so
   `List-Unsubscribe` may be replaced by Brevo's own. If it is missing, the link in the text
   still works; tell Claude and we'll look at Brevo's unsubscribe setting.

## 3. Vercel project ✓ done 18 Oct 2026

Project **aitio** (`prj_9bVcICSGk9YAz1TVEVPue1aEDaKg`), linked to `dimmu141/aitio`, functions
in `fra1`, Node 22, Vercel Authentication on preview deployments only. Live at
**https://aitio-eight.vercel.app** (`aitio.vercel.app` belongs to someone else). Production
env vars set: `DATABASE_URL` (Neon, pooled), `BETTER_AUTH_SECRET`, `CRON_SECRET`,
`REVALIDATE_SECRET`, `EMAIL_WEBHOOK_SECRET` (all sensitive), `SITE_URL`, `ADMIN_EMAILS`,
`SCRAPER_USER_AGENT`, `BREVO_API_KEY`, `EMAIL_FROM`, and since then `PRIVACY_CONTROLLER` and
`PRIVACY_EMAIL` (both shown on `/tietosuoja`, checked 20 Oct 2026). Previews have no
database on purpose (they would write to production), so preview builds are skipped.

**Custom domain:** `omaaitio.fi` (A `76.76.21.21`) and `www` (CNAME `cname.vercel-dns.com`,
308 to the apex) since 18 Oct 2026; `SITE_URL=https://omaaitio.fi`. Sign-in only works on
that origin.

The first production deployment was made from the PR branch; once PR #1 is merged, pushes
to `main` deploy production.


- Plan: **Hobby is enough.** Since January 2026 every plan allows 100 cron jobs per project.
  Hobby runs each at most once a day (ours are daily and weekly) and fires them somewhere
  within the scheduled hour; functions get up to 300 s. Sources:
  https://vercel.com/docs/cron-jobs/usage-and-pricing and https://vercel.com/docs/functions/limitations
  (both read 2026-10-18). Hobby is for non-commercial use; if Aitio ever earns money
  (ads, affiliate ticket links), move to Pro.
- Domain: **`aitio.fi` is taken** (registered since 2010 to Kiinteistö Oy Aitio Business Park
  Vivaldi, paid until 21 Oct 2027; checked in the .fi registry's RDAP on 18 Oct 2026).
  `teatteriaitio.fi` and `aitio-teatteri.fi` were unregistered then. Vercel doesn't sell
  `.fi`; buy it from a Finnish reseller and point it at Vercel, then change `SITE_URL`,
  `EMAIL_FROM` and the Brevo sender domain to match. Every `aitio.fi` in this runbook is a
  placeholder until then.
- Preview builds are skipped (Ignored Build Step: only `VERCEL_ENV=production` builds), since
  previews have no database.
- Environment variables (Production), see `.env.example`:

| Variable | Value |
|---|---|
| `SITE_URL` | `https://aitio.fi` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET`, `REVALIDATE_SECRET`, `EMAIL_WEBHOOK_SECRET` | `openssl rand -base64 32` each |
| `BREVO_API_KEY`, `EMAIL_FROM` | from step 2 |
| `ADMIN_EMAILS` | your address |
| `PRIVACY_CONTROLLER`, `PRIVACY_EMAIL` | **you decide**: your name (a private person can be the controller) and a contact address you read. `PRIVACY_EMAIL` is the one contact everywhere: privacy policy, about page (also for theatres), footer and the crawler's User-Agent |
| `SCRAPER_USER_AGENT` | optional since 19 Oct 2026: without it the crawler sends `AitioBot/1.0 (+<SITE_URL>/tietoa; <PRIVACY_EMAIL>)`. If you keep the one set in Vercel, make sure it names `PRIVACY_EMAIL` (`launch:check` warns otherwise) |

**Check:**

```bash
vercel env pull .env.production.local --environment=production
pnpm launch:check .env.production.local   # must print "Ready"
rm .env.production.local
```

## 4. Legal

- **you decide:** have someone who knows data protection read `/tietosuoja`
  (`src/lib/privacy.ts`). It is written to match the code (the retention numbers are the
  code's own constants), but it is not legal advice.
- The theatres: a short email to each press office before the first public scrape
  ("we link to your pages and ticket shop, store no texts or images, and here is our
  bot's User-Agent") prevents surprises and is good manners.

## 5. First production run

1. Deploy. Visit `/`, `/tietosuoja`, `/sitemap.xml`.
2. Trigger each scrape once by hand, a minute apart:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://aitio.fi/api/cron/scrape/hkt`
3. Open `/yllapito`: every source should show "Kunnossa" (OK).
4. Trigger `/api/cron/cleanup` and, with yourself opted in, `/api/cron/digest`.
5. **Check:** the next morning `/yllapito` shows six fresh runs from the cron.

## After launch

- Watch `/yllapito` daily for the first week; scrape alerts go to `ADMIN_EMAILS`.
- Brevo's dashboard: bounce rate under 2 %, complaint rate under 0.1 %.
- Search Console: submit `https://aitio.fi/sitemap.xml`.
