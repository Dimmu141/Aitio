import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { ProductionCard } from "@/components/ProductionCard";
import { buttonPrimary } from "@/components/ui";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { unwatchAction, watchAction } from "@/lib/actions";
import type { ProductionCard as Card } from "@/lib/catalogue/types";
import { getWatchlist, isOnWatchlist, productionTitle } from "@/lib/diary/watchlist";
import { getDigestOptIn } from "@/lib/engagement/send-digests";
import { requireUser } from "@/lib/session";

/** Personal and per request. */
export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function RemoveButton({ slug, locale, t }: { slug: string; locale: Locale; t: Dictionary }) {
  return (
    <form action={unwatchAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="inline-flex min-h-tap items-center text-meta text-accent underline">
        {t.watch.remove}
      </button>
    </form>
  );
}

function Group({ id, title, cards, asOf, locale, t }: { id: string; title: string; cards: Card[]; asOf: Date; locale: Locale; t: Dictionary }) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={id} className="ai-section">
      <h2 id={id} className="ai-section__title">
        {title}
      </h2>
      <ul>
        {cards.map((card) => (
          <ProductionCard key={card.slug} card={card} asOf={asOf} locale={locale} t={t}>
            <RemoveButton slug={card.slug} locale={locale} t={t} />
          </ProductionCard>
        ))}
      </ul>
    </section>
  );
}

/** After signing in from a show's page: ask once more, since the GET itself must not add anything. */
async function PendingAdd({ slug, userId, locale, t }: { slug: string; userId: string; locale: Locale; t: Dictionary }) {
  const title = await productionTitle(slug);
  if (!title || (await isOnWatchlist(userId, slug))) return null;
  return (
    <form action={watchAction} className="space-y-3 rounded-md border-[1.5px] border-rule-strong bg-paper-raised p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <p className="font-bold">{t.watch.confirm(title)}</p>
      <button type="submit" className={buttonPrimary}>
        {t.watch.confirmButton}
      </button>
    </form>
  );
}

export default async function WatchlistPage({ searchParams }: PageProps<"/[locale]/haluan-nahda">) {
  const [{ locale, t }, query] = await Promise.all([getDictionary(), searchParams]);
  const user = await requireUser(locale, href(locale, "haluan-nahda"));
  const asOf = new Date();
  const [list, digestOn] = await Promise.all([getWatchlist(user.id, asOf), getDigestOptIn(user.id)]);
  const added = single(query.lisatty);
  const addedTitle = added ? await productionTitle(added) : null;
  const pending = single(query.lisaa);
  const total = list.playing.length + list.gone.length;

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b-4 border-double border-ink pb-4">
        <h1 className="text-display">{t.watch.title}</h1>
        <p className="text-ink-muted">{t.watch.intro}</p>
      </header>

      {addedTitle && <Notice>{t.watch.added(addedTitle)}</Notice>}
      {query.poistettu && <Notice>{t.watch.removed}</Notice>}
      {query.error === "rate" && <Notice tone="error">{t.watch.rate}</Notice>}
      {pending && <PendingAdd slug={pending} userId={user.id} locale={locale} t={t} />}

      {total === 0 ? (
        <p className="text-lg">
          {t.watch.empty} <Link href={href(locale)}>{t.home.title}</Link>
        </p>
      ) : (
        <>
          {list.playing.length > 0 &&
            (digestOn ? (
              <p className="text-meta text-ink-muted">{t.watch.digestOn}</p>
            ) : (
              <p>
                {t.watch.digestHint}{" "}
                <Link href={`${href(locale, "asetukset")}#kooste`} className="inline-flex min-h-tap items-center">
                  {t.watch.digestLink}
                </Link>
              </p>
            ))}
          <Group id="playing" title={t.watch.playing} cards={list.playing} asOf={asOf} locale={locale} t={t} />
          <Group id="gone" title={t.watch.gone} cards={list.gone} asOf={asOf} locale={locale} t={t} />
        </>
      )}
    </div>
  );
}
