import type { ReactNode } from "react";

/** Outbound link. Opens in the same tab (easier to get back with the back button) and says it leaves the site. */
export function ExternalLink({
  href,
  hint,
  children,
  className,
}: {
  href: string;
  hint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} rel="noopener external" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> ({hint})</span>
    </a>
  );
}
