import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { buttonDanger, buttonSecondary } from "@/components/ui";
import { ProductionType } from "@/generated/prisma/enums";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";
import { moderateAction, setTypeOverrideAction } from "@/lib/admin-actions";
import { db } from "@/lib/db";
import { moderationQueue } from "@/lib/diary/service";
import { formatPerformance } from "@/lib/format";
import { isAdmin } from "@/lib/ops/admin";
import { typeReviewQueue } from "@/lib/ops/catalogue-admin";
import { recentRuns, type RunRow } from "@/lib/ops/runs";
import { health, type Health } from "@/lib/ops/schedule";
import { requireUser } from "@/lib/session";
import { ADAPTERS } from "@/scrapers/run";

/**
 * Internal tool for Dimmu: scrape health, type review and moderation. Finnish only on
 * purpose (one reader), so the strings live here rather than in the dictionaries.
 */
export const instant = false;

export const metadata: Metadata = { title: "Ylläpito", robots: { index: false } };

const HEALTH_LABEL: Record<Health, string> = {
  ok: "Kunnossa",
  partial: "Osittain epäonnistui",
  failed: "Epäonnistui",
  stuck: "Jumissa",
  running: "Käynnissä",
  never: "Ei ajettu",
};

function HealthBadge({ value }: { value: Health }) {
  const tone = value === "ok" ? "border-ink" : value === "running" || value === "never" ? "border-rule" : "border-accent text-accent";
  return <span className={`rounded-md border-2 px-2 py-0.5 text-base font-semibold ${tone}`}>{HEALTH_LABEL[value]}</span>;
}

async function ScrapeHealth({ now }: { now: Date }) {
  const [runs, theatres] = await Promise.all([
    recentRuns(),
    db.theatre.findMany({ select: { name: true, sourceId: true }, orderBy: { name: "asc" } }),
  ]);
  const names = new Map(theatres.map((theatre) => [theatre.sourceId, theatre.name]));
  const bySource = (id: string): RunRow[] => runs.filter((run) => run.sourceId === id);
  return (
    <section aria-labelledby="haut" className="space-y-4">
      <h2 id="haut" className="text-section">
        Haut
      </h2>
      <ul className="space-y-4">
        {Object.keys(ADAPTERS).map((id) => {
          const history = bySource(id);
          const latest = history[0];
          return (
            <li key={id} className="space-y-2 rounded-md border border-rule bg-paper-raised p-4">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-card font-semibold">{names.get(id) ?? id}</span>
                <HealthBadge value={health(latest, now)} />
              </p>
              {latest && (
                <p className="text-base">
                  {formatPerformance(latest.startedAt, "fi", now)} · löytyi {latest.itemsFound}, tallennettu{" "}
                  {latest.itemsChanged}, epäonnistui {latest.failedDetails}
                  {latest.message && <span className="block font-semibold text-accent">{latest.message}</span>}
                </p>
              )}
              {history.length > 1 && (
                <details>
                  <summary className="cursor-pointer text-base">Aiemmat ajot</summary>
                  <ul className="mt-1 text-base">
                    {history.slice(1, 10).map((run) => (
                      <li key={run.id}>
                        {formatPerformance(run.startedAt, "fi", now)} · {run.status} · {run.itemsFound}/{run.itemsChanged}
                        {run.failedDetails > 0 && ` · ${run.failedDetails} virhettä`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function TypeReview() {
  const { t } = await getDictionary();
  const rows = await typeReviewQueue();
  return (
    <section aria-labelledby="tyypit" className="space-y-4">
      <h2 id="tyypit" className="text-section">
        Lajityypit
      </h2>
      <p className="text-base text-ink-muted">Luokittelija on epävarma näistä, tai tyyppi on jo korjattu käsin.</p>
      {rows.length === 0 ? (
        <p>Ei tarkistettavaa.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-end justify-between gap-3 border-b border-rule py-3">
              <span>
                <Link href={href("fi", "esitys", row.slug)} className="font-semibold">
                  {row.title}
                </Link>
                <span className="block text-base text-ink-muted">
                  {row.theatre} · arvaus {t.types[row.type]} ({Math.round(row.typeConfidence * 100)} %)
                </span>
              </span>
              <form action={setTypeOverrideAction} className="flex w-full flex-wrap gap-2 sm:w-auto">
                <input type="hidden" name="productionId" value={row.id} />
                <label className="sr-only" htmlFor={`type-${row.id}`}>
                  Lajityyppi
                </label>
                <select
                  id={`type-${row.id}`}
                  name="type"
                  defaultValue={row.typeOverride ?? ""}
                  className="min-h-tap min-w-0 flex-1 rounded-md border-2 border-rule bg-paper-raised px-2"
                >
                  <option value="">Automaattinen ({t.types[row.type]})</option>
                  {Object.values(ProductionType).map((type) => (
                    <option key={type} value={type}>
                      {t.types[type]}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonSecondary}>
                  Tallenna
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Moderation() {
  const queue = await moderationQueue();
  return (
    <section aria-labelledby="ilmoitukset" className="space-y-4">
      <h2 id="ilmoitukset" className="text-section">
        Ilmoitukset
      </h2>
      {queue.length === 0 ? (
        <p>Ei avoimia ilmoituksia.</p>
      ) : (
        <ul className="space-y-4">
          {queue.map((item) => (
            <li key={item.entryId} className="space-y-2 rounded-md border border-rule bg-paper-raised p-4">
              <p className="font-semibold">
                {item.production}
                {item.hidden && <span className="ml-2 text-accent">(piilotettu automaattisesti)</span>}
              </p>
              <p className="text-base text-ink-muted">
                {item.author} ·{" "}
                {Object.entries(item.reasons)
                  .map(([reason, count]) => `${reason} ×${count}`)
                  .join(", ")}
              </p>
              <blockquote className="whitespace-pre-line break-words border-l-4 border-rule pl-3">{item.review}</blockquote>
              <form action={moderateAction} className="flex flex-wrap gap-3">
                <input type="hidden" name="entryId" value={item.entryId} />
                <button type="submit" name="decision" value="hide" className={buttonDanger}>
                  Piilota
                </button>
                <button type="submit" name="decision" value="show" className={buttonSecondary}>
                  Näytä
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/[locale]/yllapito">) {
  const [{ locale }, query] = await Promise.all([getDictionary(), searchParams]);
  const user = await requireUser(locale, href(locale, "yllapito"));
  // Not "forbidden": non-admins shouldn't learn the page exists.
  if (!isAdmin(user.email)) notFound();
  const now = new Date();

  return (
    <div className="space-y-12">
      <h1 className="border-b-4 border-double border-ink pb-4 text-display">Ylläpito</h1>
      {query.saved && <Notice>Tallennettu.</Notice>}
      <ScrapeHealth now={now} />
      <TypeReview />
      <Moderation />
    </div>
  );
}
