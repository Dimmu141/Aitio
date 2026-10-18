import { z } from "zod";

export const CREDIT_ROLES = [
  "DIRECTOR",
  "WRITER",
  "COMPOSER",
  "TRANSLATOR",
  "CHOREOGRAPHER",
  "DESIGNER",
  "CAST",
  "OTHER",
] as const;
export type CreditRoleName = (typeof CREDIT_ROLES)[number];

export const PRODUCTION_TYPES = [
  "PLAY",
  "MUSICAL",
  "OPERA",
  "DANCE",
  "CONCERT",
  "STANDUP",
  "TALK",
  "OTHER",
] as const;
export type ProductionTypeName = (typeof PRODUCTION_TYPES)[number];

/** One entry from a theatre's listing (list page or REST endpoint). */
export const rawProductionSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  stageHint: z.string().optional(),
  authorHint: z.string().optional(),
  isVisiting: z.boolean().default(false),
});
export type RawProduction = z.infer<typeof rawProductionSchema>;

export const rawCreditSchema = z.object({
  name: z.string().min(1),
  roleText: z.string(),
  roles: z.array(z.enum(CREDIT_ROLES)).min(1),
  characterName: z.string().optional(),
});
export type RawCredit = z.infer<typeof rawCreditSchema>;

export const rawPerformanceSchema = z.object({
  /** UTC instant of the start time. */
  startsAt: z.date(),
  stage: z.string().optional(),
  ticketUrl: z.url().optional(),
  /** Subtitles at this performance only; leave out when they apply to every performance. */
  subtitleLangs: z.array(z.string()).optional(),
});
export type RawPerformance = z.infer<typeof rawPerformanceSchema>;

export const rawCriticReviewSchema = z.object({
  outlet: z.string().min(1),
  critic: z.string().optional(),
  url: z.url(),
  publishedAt: z.date().optional(),
});
export type RawCriticReview = z.infer<typeof rawCriticReviewSchema>;

/** Everything an adapter can read from one production page. */
export const rawProductionDetailSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  stage: z.string().optional(),
  subtitle: z.string().optional(),
  durationText: z.string().optional(),
  premiereDate: z.date().optional(),
  runStart: z.date().optional(),
  runEnd: z.date().optional(),
  languages: z.array(z.string()),
  subtitleLangs: z.array(z.string()),
  credits: z.array(rawCreditSchema),
  performances: z.array(rawPerformanceSchema),
  criticReviews: z.array(rawCriticReviewSchema),
  isVisiting: z.boolean().default(false),
});
export type RawProductionDetail = z.infer<typeof rawProductionDetailSchema>;

export interface SourceAdapter {
  /** Matches Theatre.sourceId in the database. */
  id: string;
  fetchProductions(): Promise<RawProduction[]>;
  fetchProductionDetail(ref: RawProduction): Promise<RawProductionDetail>;
}
