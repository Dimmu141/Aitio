/** Inline message for empty or unavailable data. */
export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-rule bg-paper-raised p-4 text-ink-muted">{children}</p>;
}
