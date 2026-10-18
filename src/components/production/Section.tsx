import type { ReactNode } from "react";

/** A page section under a 2px ink rule, like a heading in a printed programme. */
export function Section({ id, title, aside, children }: { id: string; title: string; aside?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="ai-section">
      <div className="ai-section__head">
        <h2 id={id} className="ai-section__title">
          {title}
        </h2>
        {aside && <p className="ai-section__aside">{aside}</p>}
      </div>
      {children}
    </section>
  );
}
