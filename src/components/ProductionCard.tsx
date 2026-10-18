import Link from "next/link";
import { t } from "@/i18n/fi";
import { formatPerformance } from "@/lib/format";
import type { ProgrammeItem } from "@/lib/queries";
import { BadgeRow } from "./Badge";
import { PosterSmall } from "./Poster";

/** One production in a list: small poster, title, where, and when next. */
export function ProductionCard({ item, now, showTheatre = true }: { item: ProgrammeItem; now: Date; showTheatre?: boolean }) {
  const place = [showTheatre ? item.theatre.name : null, item.stage].filter(Boolean).join(" · ");
  return (
    <li className="border-b border-rule py-4">
      <Link href={`/esitys/${item.slug}`} className="flex gap-4 text-ink no-underline">
        <PosterSmall slug={item.slug} title={item.title} />
        <div className="grid min-w-0 content-start gap-1">
          <h3 className="text-card-title underline decoration-rule-strong decoration-1 underline-offset-4">{item.title}</h3>
          {place && <p className="text-meta text-ink-muted">{place}</p>}
          <p className="text-meta">{t.production.next(formatPerformance(item.nextPerformance, now))}</p>
        </div>
      </Link>
      <div className="mt-3">
        <BadgeRow languages={item.languages} subtitleLangs={item.subtitleLangs} closing={item.status.phase === "closing"} />
      </div>
    </li>
  );
}

export function ProductionList({ items, now, showTheatre }: { items: ProgrammeItem[]; now: Date; showTheatre?: boolean }) {
  return (
    <ul className="border-t border-rule">
      {items.map((item) => (
        <ProductionCard key={item.slug} item={item} now={now} showTheatre={showTheatre} />
      ))}
    </ul>
  );
}
