import type { CreditRoleName } from "./types";

const SKIP_WORDS =
  /\S*(?:uppföranderätt|esitysoikeu|oikeuksien|rättigheter|tuottaja|tuotanto|producent|production|valokuv|kuvaaja|fotograf|photograph|teknikko|tekniker|intimitet)\S*|bygge av \S+|\S*bygge\S*|\S*rakenta\S*|(?:\S+\s+)?mentor\S*/;

/**
 * Map a free-text role label (Finnish or Swedish) to credit roles.
 * Returns an empty array for roles we deliberately skip (rights holders, producers).
 * One label can map to several roles: "Ohjaus ja käsikirjoitus" → DIRECTOR + WRITER.
 */
export function mapRoleText(roleText: string): CreditRoleName[] {
  const lower = roleText.toLowerCase();
  // Rights agencies, producers, photographers, technicians, builders and mentors are not
  // the creative team. Their words are cut out, so "Teksti, ohjaus, … tuotanto ja
  // esiintyminen" keeps its other roles, and "Esitysvalokuvat" is not lighting design.
  const skipped = SKIP_WORDS.test(lower);
  const text = lower.replace(new RegExp(SKIP_WORDS.source, "g"), " ");
  const roles = new Set<CreditRoleName>();
  // "Ohjaajan assistentti", "Apulaisohjaaja", "Koreografinen assistentti" are not the lead.
  const isAssistant = /assist|apulais|apuohjaa/.test(text);
  if (!isAssistant && /ohjaa|ohjaus|\bregi\b|regiss|\bdirect/.test(text)) roles.add("DIRECTOR");
  if (
    /käsikirjoit|dramatisoin|\bteksti\b|kirjoittaja|kirjailija|^näytelmä(?:$|[\s:,])|\bwriter|^av\b|^text\b|\bmanus\b|dramatis|librett|alkuperäis|författ|bearbetning/.test(text)
  ) {
    roles.add("WRITER");
  }
  // A conductor ("Musiikinjohto", "Kapellimestari") leads the music but did not write it.
  // Live musicians ("Livemusiikki", "Muusikot") play the music; they are not its composer either.
  const conducts = /musiikinjoht|kapellimest|dirigent|conduct|livemusiik|muusiko|soittaj/.test(text);
  if (!conducts && /sävel|musiikki|kompo|\bmusik\b/.test(text)) roles.add("COMPOSER");
  if (/suomennos|käännös|översättning/.test(text)) roles.add("TRANSLATOR");
  if (!isAssistant && /koreograf/.test(text)) roles.add("CHOREOGRAPHER");
  if (/suunnittel|design|lavastu|lavastaj|scenografi|kostym|puku|valo|ljus|ääni|ljud|naamio|mask|video/.test(text)) {
    roles.add("DESIGNER");
  }
  // Dance credits name dancers and performers instead of roles.
  if (/rooleissa|näyttämöllä|medverkande|ensemble|skådespel|tanssij|esiinty|näyttelij|^performance$|^cast$|dansare|dansar\b|performer|på scen/.test(text)) {
    roles.add("CAST");
  }
  if (roles.size === 0) return skipped ? [] : ["OTHER"];
  return [...roles];
}
