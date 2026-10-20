import * as cheerio from "cheerio";
import { mapRoleText } from "./roles";
import { cleanText, personName } from "./text";
import type { RawCredit } from "./types";

/**
 * A team written as running text, as guest runs at Kansallisteatteri (Kärpäset, Haapajärven
 * Elvis) and the Opera (Nocturno) have it instead of a team list:
 * "<p><strong>Käsikirjoitus ja ohjaus</strong> Sirkku Peltola <strong>…".
 * Each bold label owns the names after it, up to the next label.
 */
export function textBlockCredits(blockHtml: string): RawCredit[] {
  const $ = cheerio.load(`<div>${blockHtml.replace(/<br\s*\/?>/gi, " ")}</div>`);
  const credits: RawCredit[] = [];
  let roleText = "";
  $("div")
    .find("p")
    .contents()
    .each((_, node) => {
      const text = cleanText($(node).text());
      if (node.type === "tag" && node.name === "strong") {
        roleText = text;
        return;
      }
      const roles = roleText ? mapRoleText(roleText) : [];
      if (!text || roles.length === 0) return;
      for (const part of text.split(/,\s*|\s+ja\s+|\s+och\s+/)) {
        const name = personName(part);
        if (name && /^\p{Lu}/u.test(name)) credits.push({ name, roleText, roles });
      }
    });
  return credits;
}
