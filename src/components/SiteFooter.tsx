import type { Dictionary } from "@/i18n/dictionaries/fi";

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="mt-16 border-t border-rule">
      <p className="mx-auto max-w-3xl px-4 py-8 text-base text-ink-muted">{t.footer.facts}</p>
    </footer>
  );
}
