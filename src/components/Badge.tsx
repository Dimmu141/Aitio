import type { ReactNode } from "react";

export function BadgeRow({ children }: { children: ReactNode }) {
  return <ul className="ai-badges">{children}</ul>;
}

export function Badge({
  title,
  variant,
  children,
}: {
  /** The spelled-out meaning, for badges that show codes ("SV ruotsiksi"). */
  title?: string;
  variant?: "urgent" | "quiet";
  children: ReactNode;
}) {
  return (
    <li className={`ai-badge${variant ? ` ai-badge--${variant}` : ""}`} title={title}>
      {children}
    </li>
  );
}
