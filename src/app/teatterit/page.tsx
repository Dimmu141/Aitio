import Link from "next/link";
import { Suspense } from "react";
import { Notice } from "@/components/Notice";
import { t } from "@/i18n/fi";
import { getTheatres } from "@/lib/queries";

export const metadata = { title: t.theatre.title, alternates: { canonical: "/teatterit" } };

async function TheatreList() {
  const result = await getTheatres();
  if (!result.ok) return <Notice>{t.site.unavailable}</Notice>;
  return (
    <ul className="border-t border-rule">
      {result.data.map((theatre) => (
        <li key={theatre.slug} className="border-b border-rule">
          <Link href={`/teatteri/${theatre.slug}`} className="flex min-h-16 items-center justify-between gap-3 py-3 text-ink no-underline">
            <span>
              <span className="block text-card-title font-serif underline decoration-rule-strong decoration-1 underline-offset-4">{theatre.name}</span>
              <span className="block text-meta text-ink-muted">
                {theatre.city} · {t.theatre.productions(theatre.productionCount)}
              </span>
            </span>
            <span aria-hidden="true" className="font-bold text-accent">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TheatresPage() {
  return (
    <>
      <h1 className="text-display">{t.theatre.title}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t.theatre.lead}</p>
      <Suspense fallback={<p className="text-ink-muted">{t.site.loading}</p>}>
        <TheatreList />
      </Suspense>
    </>
  );
}
