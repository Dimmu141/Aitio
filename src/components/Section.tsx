/** A programme section: a 2px ink rule, then a serif heading. */
export function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t-2 border-ink pt-3">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-section">{title}</h2>
        {aside && <span className="text-meta text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
