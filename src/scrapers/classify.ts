import type { ProductionTypeName } from "./types";

export interface ClassificationInput {
  title: string;
  typeHint?: ProductionTypeName;
  stage?: string;
  subtitle?: string;
  hasDirector: boolean;
  /** Dance pieces credit a choreographer and usually no director (HKT's "no-no"). */
  hasChoreographer?: boolean;
  castCount: number;
}

export interface Classification {
  type: ProductionTypeName;
  confidence: number;
}

const RULES: Array<{ type: ProductionTypeName; pattern: RegExp; confidence: number }> = [
  { type: "STANDUP", pattern: /stand[- ]?up|standup/i, confidence: 0.95 },
  { type: "TALK", pattern: /keskustelu|samtal|luento|föreläsning|podcast|introduktion|kirjailijat lavalla|tekijätapaaminen|seminaari/i, confidence: 0.85 },
  { type: "CONCERT", pattern: /konsert|unplugged|laulustudio|runoill|lavaklubi|trubaduuri|jubileum|joulukonsertti|julkonsert/i, confidence: 0.8 },
  { type: "OPERA", pattern: /\booppera|\bopera\b/i, confidence: 0.8 },
  { type: "DANCE", pattern: /\btanssi|\bdans\b|baletti|balett|dance company|nykytanssi/i, confidence: 0.75 },
  { type: "MUSICAL", pattern: /musikaali|musikal\b|musical/i, confidence: 0.85 },
];

/**
 * Rule-based first pass. Anything with a director and a cast that matches no
 * other rule is most likely a play. Admins can override via Production.typeOverride.
 */
export function classifyProduction(input: ClassificationInput): Classification {
  if (input.typeHint && input.typeHint !== "OTHER") return { type: input.typeHint, confidence: 0.9 };
  const haystack = [input.title, input.stage, input.subtitle].filter(Boolean).join(" | ");
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }
  // Musicals and plays have a choreographer too, but always a director.
  if (input.hasChoreographer && !input.hasDirector) {
    return { type: "DANCE", confidence: 0.7 };
  }
  if (input.hasDirector && input.castCount >= 2) {
    return { type: "PLAY", confidence: 0.7 };
  }
  if (input.hasDirector || input.castCount > 0) {
    return { type: "PLAY", confidence: 0.5 };
  }
  return { type: "OTHER", confidence: 0.2 };
}
