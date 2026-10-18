import type { ProductionType } from "@/generated/prisma/enums";
import { t } from "@/i18n/fi";

type BadgeVariant = "default" | "urgent" | "quiet";

const VARIANT: Record<BadgeVariant, string> = {
  default: "border-rule-strong bg-paper-raised text-ink",
  urgent: "border-urgent bg-urgent text-ink-fixed",
  quiet: "border-rule bg-paper-raised text-ink-muted",
};

export function Badge({ children, variant = "default", title }: { children: React.ReactNode; variant?: BadgeVariant; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex min-h-8 items-center gap-1 rounded-sm border-[1.5px] px-2.5 text-[15px] leading-5 font-bold tracking-[0.02em] ${VARIANT[variant]}`}
    >
      {children}
    </span>
  );
}

type BadgeRowProps = {
  type?: ProductionType;
  languages: string[];
  subtitleLangs: string[];
  closing?: boolean;
};

/** Type, performance language and subtitles: the facts no other Finnish site filters by. */
export function BadgeRow({ type, languages, subtitleLangs, closing }: BadgeRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {closing && <Badge variant="urgent">⏳ {t.run.closingBadge}</Badge>}
      {type && type !== "OTHER" && <Badge>{t.type[type]}</Badge>}
      {languages.map((code) => (
        <Badge key={code} title={`Esityskieli: ${t.languageName[code] ?? code}`}>
          <span className="tracking-[0.06em]">{code.toUpperCase()}</span> {t.language[code] ?? ""}
        </Badge>
      ))}
      {subtitleLangs.length > 0 && <Badge>{t.subtitles(subtitleLangs)}</Badge>}
    </div>
  );
}
