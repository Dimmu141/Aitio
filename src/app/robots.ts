import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { href } from "@/i18n/paths";
import type { Section } from "@/i18n/config";
import { absoluteUrl } from "@/lib/site";

/**
 * Crawlers that collect training data and send no visitors back. In the week of 19 Oct
 * 2026 meta-externalagent and ClaudeBot made 60 % of all requests, and every one of
 * them was Fluid CPU on the shared Hobby budget. Search and user-triggered agents
 * (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot) stay
 * allowed: they are how people find a show.
 */
export const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "meta-externalagent",
  "CCBot",
  "Bytespider",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "ImagesiftBot",
  "Timpibot",
  "omgili",
] as const;

/** Pages with nothing to index: sign-in, personal pages, forms. They all render per request. */
const PRIVATE_SECTIONS: Section[] = [
  "kirjaudu",
  "merkitse",
  "paivakirja",
  "haluan-nahda",
  "asetukset",
  "ilmoita",
  "yllapito",
  "peru-tilaus",
];

export function disallowedPaths(): string[] {
  const sections = LOCALES.flatMap((locale) => PRIVATE_SECTIONS.map((section) => `${href(locale, section)}/`));
  const bare = LOCALES.flatMap((locale) => PRIVATE_SECTIONS.map((section) => `${href(locale, section)}$`));
  // Every query string is a filter or a calendar file: per-request work with no new content.
  return ["/api/", "/*?", ...bare, ...sections];
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...TRAINING_CRAWLERS], disallow: "/" },
      // Share images: X's crawler obeys robots.txt and would otherwise drop the card.
      { userAgent: "*", allow: "/api/og/", disallow: disallowedPaths() },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
