/**
 * Press or blog, for a review link. Theatres list both under "reviews" (HKT, Ryhmäteatteri),
 * and often host the link on their own site, so the outlet's name decides first and the
 * link's domain only second. Unknown outlets count as blogs: a newspaper missing from this
 * list is a one-line fix, while a blog shown as a critic would mislead readers.
 */
export type ReviewKind = "press" | "blog";

const PRESS_NAMES = new Set([
  "aamulehti",
  "anna",
  "apu",
  "demokraatti",
  "etelä-suomen sanomat",
  "femina",
  "helsingin sanomat",
  "helsingin uutiset",
  "hs",
  "hufvudstadsbladet",
  "hbl",
  "huomenta suomi",
  "ilta-sanomat",
  "iltalehti",
  "image",
  "kaleva",
  "kansan uutiset",
  "keskisuomalainen",
  "kirkko ja kaupunki",
  "kodin kuvalehti",
  "kulttuuritoimitus",
  "kyrkpressen",
  "maaseudun tulevaisuus",
  "me naiset",
  "mtv",
  "mtv uutiset",
  "ny tid",
  "oriveden sanomat",
  "rondo",
  "savon sanomat",
  "seura",
  "suomen kuvalehti",
  "svenska yle",
  "teatteri",
  "teatteri-lehti",
  "timeout helsinki",
  "turun sanomat",
  "uusi suomi",
  "vasabladet",
  "voima",
  "yle",
  "yle uutiset",
  "åbo underrättelser",
  "österbottens tidning",
  "heinolan uutiset",
]);

const PRESS_HOSTS = [
  "hs.fi",
  "hbl.fi",
  "yle.fi",
  "apu.fi",
  "demokraatti.fi",
  "ku.fi",
  "suomenkuvalehti.fi",
  "ess.fi",
  "rondo.fi",
  "mtv.fi",
  "mtvuutiset.fi",
  "kulttuuritoimitus.fi",
  "orivedensanomat.fi",
  "is.fi",
  "iltalehti.fi",
  "aamulehti.fi",
  "ts.fi",
  "ksml.fi",
  "kaleva.fi",
  "maaseuduntulevaisuus.fi",
  "kirkkojakaupunki.fi",
  "vasabladet.fi",
  "ostnyland.fi",
  "abounderrattelser.fi",
];

function normalise(outlet: string): string {
  return outlet.toLowerCase().replace(/\.fi$/, "").replace(/\s+/g, " ").trim();
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function reviewKind(outlet: string, url: string): ReviewKind {
  const name = normalise(outlet);
  const domain = host(url);
  if (/blog/.test(name) || /blogspot\.|wordpress\.com$/.test(domain)) return "blog";
  if (PRESS_NAMES.has(name)) return "press";
  return PRESS_HOSTS.some((press) => domain === press || domain.endsWith(`.${press}`)) ? "press" : "blog";
}
