import type { CreditRole, ProductionType } from "@/generated/prisma/enums";

export interface TheatreRef {
  slug: string;
  name: string;
  city: string;
}

/** What a list row needs: front page, theatre page, person page. */
export interface ProductionCard {
  slug: string;
  title: string;
  theatre: TheatreRef;
  stage: string | null;
  type: ProductionType;
  languages: string[];
  subtitleLangs: string[];
  next: Date | null;
  last: Date | null;
  onSoon: boolean;
  closingSoon: boolean;
  /** For productions no longer playing: "Esitetty 2024". */
  year: number | null;
}

export interface PerformanceRow {
  startsAt: Date;
  stage: string | null;
  ticketUrl: string | null;
  /** Subtitles at this performance only (e.g. Wednesdays); production-wide ones are on the production. */
  subtitleLangs: string[];
}

export interface CreditRow {
  role: CreditRole;
  person: { slug: string; name: string };
  characterName: string | null;
}
