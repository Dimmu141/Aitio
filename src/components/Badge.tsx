import type { ReactNode } from "react";

export function BadgeRow({ children }: { children: ReactNode }) {
  return <ul className="flex flex-wrap gap-2">{children}</ul>;
}

export function Badge({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <li className="rounded border border-rule bg-card px-2.5 py-1 text-base">
      {label && <span className="text-ink-muted">{label}: </span>}
      {children}
    </li>
  );
}
