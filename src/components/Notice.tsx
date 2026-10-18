import type { ReactNode } from "react";

/** A status line after an action ("Tallennettu"), or an error. Announced by screen readers. */
export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded border-l-4 px-4 py-3 ${tone === "error" ? "border-accent bg-card font-semibold" : "border-ink bg-card"}`}
    >
      {children}
    </p>
  );
}
