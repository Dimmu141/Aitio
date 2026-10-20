import type { ProductionTypeName } from "./types";

export interface ClassificationInput {
  title: string;
  typeHint?: ProductionTypeName;
  stage?: string;
  subtitle?: string;
  hasDirector: boolean;
  /** Dance pieces credit a choreographer and usually no director (HKT's "no-no"). */
  hasChoreographer?: boolean;
  /** Someone wrote or dramatised the text: a script exists. */
  hasWriter?: boolean;
  /** Musicals and operas credit a composer; most plays don't. */
  hasComposer?: boolean;
  /** A conductor or musical director ("Kapellmästare", "Kapellimestari"): a musical, with a director. */
  hasConductor?: boolean;
  /** Credits for instruments ("Violin", "Trummor"): a band on stage, i.e. a concert when they outnumber the cast. */
  musicianCount?: number;
  castCount: number;
}

const CONDUCTOR = /kapellmästare|kapellimest|musikalisk led|musiikinjoh|musiikillinen joh|dirigent|conductor|musical director/i;
const INSTRUMENT =
  /^(?:violin|viulu|fiol|trummor|rummut|slagverk|lyömäsoittimet|piano|flygel|kontrabas|basso|bas|kitara|gitarr|guitar|trumpet|trumpetti|trombon|pasuuna|tuba|klarinett|klarinetti|saxofon|saksofoni|cello|sello|dragspel|harmonikka|vibrafon|tangentinstrument|kosketinsoittimet|keyboards?)\b/i;

export function isConductorLabel(roleText: string): boolean {
  return CONDUCTOR.test(roleText);
}

export function isInstrumentLabel(roleText: string): boolean {
  return INSTRUMENT.test(roleText.trim());
}

export interface Classification {
  type: ProductionTypeName;
  confidence: number;
}

/** Not performances at all: open houses, guided tours, job ads, family days. */
export const NOT_A_PERFORMANCE =
  /konstens natt|taiteiden yö|familjelördag|perhelauantai|kostymprovning|rundvandring|opastettu kierros|anställer|rekrytoi/i;

const RULES: Array<{ type: ProductionTypeName; pattern: RegExp; confidence: number }> = [
  // Visitors never see "Muu", and these can't be logged as seen (canBeSeen).
  { type: "OTHER", pattern: NOT_A_PERFORMANCE, confidence: 0.8 },
  { type: "STANDUP", pattern: /stand[- ]?up|standup|humorlandskamp/i, confidence: 0.95 },
  {
    type: "TALK",
    pattern: /keskustelu|samtal|luento|föreläsning|podcast|introduktion|kirjailijat lavalla|tekijätapaaminen|seminaari|litteraturfestival|kirjallisuusfestivaali/i,
    confidence: 0.85,
  },
  {
    type: "CONCERT",
    pattern: /konsert|unplugged|laulustudio|runoill|lavaklubi|trubaduuri|jubileum|joulukonsertti|julkonsert|ballader|sånger från|lauluilta/i,
    confidence: 0.8,
  },
  { type: "OPERA", pattern: /\booppera|\bopera\b/i, confidence: 0.8 },
  { type: "DANCE", pattern: /\btanssi|\bdans\b|baletti|balett|dance company|nykytanssi/i, confidence: 0.75 },
  // "Musikalen som inte lämnar någon oberörd" (Next to Normal's subtitle) needs the definite form too.
  { type: "MUSICAL", pattern: /musikaali|musikal(?:en)?\b|musical/i, confidence: 0.85 },
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
  // The source files it under "other" (the Opera's "Muuta": Nocturno, contemporary circus):
  // a director alone doesn't make it a play. Low confidence puts it on the admin's type list.
  if (input.typeHint === "OTHER") return { type: "OTHER", confidence: 0.3 };
  // A band credited player by player, outnumbering the cast: a concert (Georg Malmstén & HumppAvanti!).
  if ((input.musicianCount ?? 0) >= 3 && (input.musicianCount ?? 0) > input.castCount) {
    return { type: "CONCERT", confidence: 0.75 };
  }
  // A conductor and a director: a musical (Mary Poppins, Next to Normal); operas say so earlier.
  if (input.hasConductor && input.hasDirector) {
    return { type: "MUSICAL", confidence: 0.7 };
  }
  // Musicals and plays have a choreographer too, but always a director.
  if (input.hasChoreographer && !input.hasDirector) {
    return { type: "DANCE", confidence: 0.7 };
  }
  if (input.hasDirector && input.castCount >= 2) {
    return { type: "PLAY", confidence: 0.7 };
  }
  // A script and a director, without a composer: a play even when the cast isn't listed.
  if (input.hasDirector && input.hasWriter && !input.hasComposer) {
    return { type: "PLAY", confidence: 0.65 };
  }
  if (input.hasDirector || input.castCount > 0) {
    return { type: "PLAY", confidence: 0.5 };
  }
  return { type: "OTHER", confidence: 0.2 };
}
