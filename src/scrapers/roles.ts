import type { CreditRoleName } from "./types";

/**
 * Map a free-text role label (Finnish or Swedish) to credit roles.
 * Returns an empty array for roles we deliberately skip (rights holders, producers).
 * One label can map to several roles: "Ohjaus ja käsikirjoitus" → DIRECTOR + WRITER.
 */
export function mapRoleText(roleText: string): CreditRoleName[] {
  const text = roleText.toLowerCase();
  if (/uppföranderätt|esitysoikeu|rättigheter|tuottaja|producent/.test(text)) {
    return [];
  }
  const roles = new Set<CreditRoleName>();
  // "Ohjaajan assistentti", "Apulaisohjaaja", "Regiassistent" are not directors.
  const isAssistant = /assist|apulais/.test(text);
  if (!isAssistant && /ohjaa|ohjaus|\bregi\b|regiss/.test(text)) roles.add("DIRECTOR");
  if (
    /käsikirjoit|dramatisoin|\bteksti\b|kirjoittaja|\bav\b|^text\b|manus|dramatis|librett|alkuperäisteos|författ|bearbetning/.test(text)
  ) {
    roles.add("WRITER");
  }
  if (/sävel|musiikki|kompo|\bmusik\b/.test(text)) roles.add("COMPOSER");
  if (/suomennos|käännös|översättning/.test(text)) roles.add("TRANSLATOR");
  if (/koreograf/.test(text)) roles.add("CHOREOGRAPHER");
  if (/suunnittel|design|lavastu|scenografi|kostym|puku|valo|ljus|ääni|ljud|naamio|mask|video/.test(text)) {
    roles.add("DESIGNER");
  }
  if (/rooleissa|näyttämöllä|medverkande|ensemble|skådespel/.test(text)) {
    roles.add("CAST");
  }
  return roles.size > 0 ? [...roles] : ["OTHER"];
}
