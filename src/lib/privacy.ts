import type { Locale } from "@/i18n/config";
import { DRAFT_MINUTES, SESSION_DAYS, SIGN_IN_MINUTES } from "@/lib/auth-config";
import { RATE_LIMIT_RETENTION_DAYS } from "@/lib/ops/cleanup";

/**
 * The privacy policy (GDPR articles 13 and 14). The text quotes the real retention
 * constants, so changing one changes the policy. Bump POLICY_DATE when the meaning
 * changes, and have a person who knows data protection read it before launch.
 */
export const POLICY_DATE = new Date("2026-10-23T00:00:00Z");

/** The database provider's restore window: deleted data lives on in backups this long. */
export const BACKUP_DAYS = 7;

export interface PrivacyConfig {
  controller: string;
  email: string;
}

/** From the environment; the launch check refuses to pass without them. */
export function privacyConfig(): PrivacyConfig {
  return {
    controller: process.env.PRIVACY_CONTROLLER ?? "",
    email: process.env.PRIVACY_EMAIL ?? "",
  };
}

/** A paragraph, or a bullet list when it's an array. */
export type Block = string | string[];

export interface PolicySection {
  heading: string;
  blocks: Block[];
}

export interface Policy {
  title: string;
  intro: string;
  updated: string;
  sections: PolicySection[];
}

interface Processor {
  name: string;
  role: Record<Locale, string>;
  where: Record<Locale, string>;
}

const PROCESSORS: Processor[] = [
  {
    name: "Vercel Inc.",
    role: { fi: "verkkopalvelun palvelimet", sv: "webbtjänstens servrar", en: "web hosting" },
    where: {
      fi: "Yhdysvaltalainen yritys; palvelu ajetaan Frankfurtissa. Siirrot EU:n ja Yhdysvaltojen tietosuojakehyksen (DPF) ja EU:n vakiolausekkeiden perusteella.",
      sv: "Amerikanskt företag; tjänsten körs i Frankfurt. Överföringar enligt dataskyddsramen mellan EU och USA (DPF) och EU:s standardavtalsklausuler.",
      en: "US company; the site runs in Frankfurt. Transfers under the EU–US Data Privacy Framework and the EU Standard Contractual Clauses.",
    },
  },
  {
    name: "Neon Inc.",
    role: { fi: "tietokanta", sv: "databas", en: "database" },
    where: {
      fi: "Yhdysvaltalainen yritys; tiedot säilytetään Frankfurtissa. Siirrot DPF:n ja vakiolausekkeiden perusteella.",
      sv: "Amerikanskt företag; uppgifterna lagras i Frankfurt. Överföringar enligt DPF och standardavtalsklausulerna.",
      en: "US company; data is stored in Frankfurt. Transfers under the DPF and the Standard Contractual Clauses.",
    },
  },
  {
    name: "GitHub Inc. (Microsoft)",
    role: {
      fi: "esitystietojen ja tekijöiden nimien haku teatterien sivuilta",
      sv: "hämtning av föreställningsuppgifter och upphovspersonernas namn från teatrarnas webbplatser",
      en: "collecting production details and credited names from the theatres' websites",
    },
    where: {
      fi: "Yhdysvaltalainen yritys; haku ajetaan Yhdysvalloissa. Siirrot DPF:n ja vakiolausekkeiden perusteella.",
      sv: "Amerikanskt företag; hämtningen körs i USA. Överföringar enligt DPF och standardavtalsklausulerna.",
      en: "US company; the collection runs in the United States. Transfers under the DPF and the Standard Contractual Clauses.",
    },
  },
  {
    name: "Sendinblue SAS (Brevo)",
    role: { fi: "sähköpostien lähetys", sv: "utskick av e-post", en: "sending email" },
    where: { fi: "Ranska, EU.", sv: "Frankrike, EU.", en: "France, EU." },
  },
];

function processors(locale: Locale): string[] {
  return PROCESSORS.map((processor) => `${processor.name}: ${processor.role[locale]}. ${processor.where[locale]}`);
}

function contactLine(config: PrivacyConfig, label: string): string {
  return `${label}: ${[config.controller, config.email].filter(Boolean).join(", ")}`;
}

function fi(config: PrivacyConfig, updated: string): Policy {
  return {
    title: "Tietosuojaseloste",
    intro:
      "Aitio on pieni, ei-kaupallinen palvelu teatteriesitysten kirjaamiseen ja löytämiseen. Keräämme vain sen, mitä palvelu tarvitsee toimiakseen. Emme myy tietoja, emme näytä mainoksia emmekä seuraa sinua muilla sivustoilla.",
    updated: `Päivitetty ${updated}`,
    sections: [
      { heading: "Rekisterinpitäjä", blocks: [contactLine(config, "Rekisterinpitäjä ja yhteystiedot tietosuoja-asioissa")] },
      {
        heading: "Mitä tietoja käsittelemme ja miksi",
        blocks: [
          [
            "Sähköpostiosoite: kirjautumiskoodien lähettäminen ja tilisi tunnistaminen. Peruste: palvelun tarjoaminen sinulle (tietosuoja-asetuksen 6.1 b artikla, sopimus).",
            "Nimi tai nimimerkki, jos annat sen: näytetään julkisten arvioidesi yhteydessä. Peruste: palvelu (6.1 b).",
            "Päiväkirja: näkemäsi esitykset, päivämäärät, arvosanat, tunnisteet ja kirjoittamasi arviot. Peruste: palvelu (6.1 b). Julkiseksi jättämäsi arvio näkyy esityksen sivulla nimesi kanssa. Arvosanat ja tunnisteet näkyvät muille vain yhteenlaskettuina, ilman nimeä.",
            "Haluan nähdä -lista: esitykset, jotka olet tallentanut nähtäväksi, ja milloin tallensit ne. Peruste: palvelu (6.1 b). Lista näkyy vain sinulle, ja esitys poistuu siltä, kun merkitset sen nähdyksi. Jos tilaat viikkoviestin, listasi esitykset nostetaan siinä ensimmäisiksi.",
            "Viikkoviesti päättyvistä esityksistä, jos tilaat sen: sähköpostiosoite ja tieto tilauksesta. Peruste: suostumus (6.1 a), jonka voit perua milloin tahansa viestin linkistä tai asetuksista.",
            "Ilmoitukset arvioista: kuka ilmoitti ja miksi, jotta samasta arviosta ei voi ilmoittaa moneen kertaan. Peruste: oikeutettu etu palvelun asiallisuuden ylläpitämiseen (6.1 f).",
            "Tekniset tiedot: kirjautumisistuntoon tallentuvat IP-osoite ja selaimen tunniste, ja käyttörajoituksiin IP-osoite ja sähköpostiosoite lyhyeksi ajaksi. Peruste: oikeutettu etu tietoturvaan ja väärinkäytösten estämiseen (6.1 f).",
          ],
          "Vuosikooste ja saavutukset lasketaan omista merkinnöistäsi aina sivua avattaessa, ja ne näkyvät vain sinulle. Emme tee automaattisia päätöksiä emmekä profiloi.",
        ],
      },
      {
        heading: "Evästeet",
        blocks: [
          `Käytämme vain kirjautumiseen välttämättömiä evästeitä (nimet alkavat aitio.), yksi niistä muistaa sähköpostiosoitteesi koodin kirjoittamisen ajan, enintään ${SIGN_IN_MINUTES} minuuttia, ja toinen säilyttää ennen kirjautumista täytetyn merkinnän salattuna enintään ${DRAFT_MINUTES} minuuttia. Niitä ei tarvitse hyväksyä erikseen. Emme käytä analytiikka-, mainos- tai seurantaevästeitä, ja fontit ladataan Aition omalta palvelimelta.`,
        ],
      },
      {
        heading: "Esitysten tekijät",
        blocks: [
          "Esitysten sivuilla näkyvät tekijöiden ja esiintyjien nimet ja roolit on koottu teatterien omilta verkkosivuilta (tietosuoja-asetuksen 14 artikla). Tarkoitus on kertoa, ketkä esityksen tekivät. Peruste: oikeutettu etu kulttuuritiedon kokoamiseen (6.1 f). Tallennamme vain nimen ja roolin. Jos haluat nimesi pois, ota yhteyttä alla olevaan osoitteeseen.",
        ],
      },
      {
        heading: "Kuinka kauan tietoja säilytetään",
        blocks: [
          [
            "Tilin tiedot, päiväkirja, Haluan nähdä -lista ja arviot: kunnes poistat tilin. Poisto asetuksista poistaa kaiken heti, myös julkiset arviot.",
            `Kirjautumisistunnot: enintään ${SESSION_DAYS} päivää, ja vanhentuneet poistetaan päivittäin.`,
            `Kirjautumiskoodit (ja niitä kantavat linkit): voimassa ${SIGN_IN_MINUTES} minuuttia, ja vanhentuneet poistetaan päivittäin. Koodista tallennetaan vain tiiviste.`,
            `Käyttörajoitusten tiedot: enintään ${RATE_LIMIT_RETENTION_DAYS} vuorokautta.`,
            `Tietokannan varmuuskopiot: poistetut tiedot häviävät niistä viimeistään ${BACKUP_DAYS} päivässä.`,
            "Palvelimen lokit: palveluntarjoajan lyhyen säilytysajan, enintään muutaman vuorokauden.",
          ],
        ],
      },
      { heading: "Kenelle tietoja luovutetaan", blocks: ["Tietoja käsittelevät puolestamme vain nämä palveluntarjoajat:", processors("fi")] },
      {
        heading: "Oikeutesi",
        blocks: [
          [
            "Saat kaikki tietosi ladattua asetuksista (JSON-tiedosto). Tämä kattaa oikeuden saada pääsy tietoihin ja siirtää ne.",
            "Voit korjata nimesi ja merkintäsi itse.",
            "Voit poistaa tilisi ja kaikki tietosi asetuksista.",
            "Voit perua viikkoviestin suostumuksen milloin tahansa.",
            "Voit vastustaa oikeutettuun etuun perustuvaa käsittelyä ottamalla yhteyttä.",
            "Voit tehdä valituksen tietosuojavaltuutetun toimistolle (tietosuoja.fi).",
          ],
        ],
      },
      { heading: "Muutokset", blocks: ["Kerromme olennaisista muutoksista tällä sivulla ja päivitämme päivämäärän."] },
    ],
  };
}

function sv(config: PrivacyConfig, updated: string): Policy {
  return {
    title: "Dataskyddsbeskrivning",
    intro:
      "Aitio är en liten, icke-kommersiell tjänst för att logga och hitta teaterföreställningar. Vi samlar bara in det som tjänsten behöver för att fungera. Vi säljer inga uppgifter, visar inga annonser och följer dig inte på andra webbplatser.",
    updated: `Uppdaterad ${updated}`,
    sections: [
      { heading: "Personuppgiftsansvarig", blocks: [contactLine(config, "Personuppgiftsansvarig och kontakt i dataskyddsfrågor")] },
      {
        heading: "Vilka uppgifter vi behandlar och varför",
        blocks: [
          [
            "E-postadress: för att skicka inloggningskoder och känna igen ditt konto. Grund: att tillhandahålla tjänsten åt dig (dataskyddsförordningen artikel 6.1 b, avtal).",
            "Namn eller signatur, om du anger det: visas med dina offentliga recensioner. Grund: tjänsten (6.1 b).",
            "Dagboken: föreställningar du sett, datum, betyg, taggar och recensioner du skrivit. Grund: tjänsten (6.1 b). En recension du låter vara offentlig syns på föreställningens sida med ditt namn. Betyg och taggar syns för andra bara sammanräknade, utan namn.",
            "Listan Vill se: föreställningar du sparat för att se dem, och när du sparade dem. Grund: tjänsten (6.1 b). Bara du ser listan, och en föreställning försvinner från den när du markerar den som sedd. Om du beställt veckomejlet kommer föreställningarna på din lista först i det.",
            "Veckomeddelandet om föreställningar som slutar, om du beställer det: e-postadressen och uppgiften om beställningen. Grund: samtycke (6.1 a), som du kan återkalla när som helst via länken i meddelandet eller i inställningarna.",
            "Anmälningar av recensioner: vem som anmälde och varför, så att samma recension inte kan anmälas flera gånger. Grund: berättigat intresse att hålla tjänsten saklig (6.1 f).",
            "Tekniska uppgifter: inloggningssessionen sparar IP-adress och webbläsarens identifierare, och begränsningen av antalet försök sparar IP-adress och e-postadress en kort tid. Grund: berättigat intresse för informationssäkerhet och för att förhindra missbruk (6.1 f).",
          ],
          "Årssammanfattningen och utmärkelserna räknas fram ur dina egna markeringar varje gång sidan öppnas och syns bara för dig. Vi fattar inga automatiska beslut och gör ingen profilering.",
        ],
      },
      {
        heading: "Kakor",
        blocks: [
          `Vi använder bara kakor som behövs för inloggningen (namnen börjar med aitio.); en av dem minns din e-postadress medan du skriver in koden, högst ${SIGN_IN_MINUTES} minuter, och en annan håller en anteckning du fyllt i före inloggningen, krypterad, högst ${DRAFT_MINUTES} minuter. De behöver inte godkännas separat. Vi använder inga kakor för analys, reklam eller spårning, och typsnitten laddas från Aitios egen server.`,
        ],
      },
      {
        heading: "Föreställningarnas upphovspersoner",
        blocks: [
          "Namn och roller för upphovspersoner och skådespelare på föreställningarnas sidor kommer från teatrarnas egna webbplatser (dataskyddsförordningen artikel 14). Syftet är att berätta vem som gjorde föreställningen. Grund: berättigat intresse att samla kulturinformation (6.1 f). Vi sparar bara namn och roll. Kontakta oss på adressen nedan om du vill att ditt namn tas bort.",
        ],
      },
      {
        heading: "Hur länge uppgifterna sparas",
        blocks: [
          [
            "Kontot, dagboken, listan Vill se och recensionerna: tills du tar bort kontot. Borttagningen i inställningarna tar bort allt direkt, också offentliga recensioner.",
            `Inloggningssessioner: högst ${SESSION_DAYS} dagar, och utgångna tas bort dagligen.`,
            `Inloggningskoder (och länkarna som bär dem): gäller i ${SIGN_IN_MINUTES} minuter, och utgångna tas bort dagligen. Av koden sparas bara en hash.`,
            `Uppgifter för begränsningen av antalet försök: högst ${RATE_LIMIT_RETENTION_DAYS} dygn.`,
            `Säkerhetskopior av databasen: borttagna uppgifter försvinner ur dem inom ${BACKUP_DAYS} dagar.`,
            "Serverloggar: tjänsteleverantörens korta lagringstid, högst några dygn.",
          ],
        ],
      },
      { heading: "Vem uppgifterna lämnas ut till", blocks: ["Bara de här tjänsteleverantörerna behandlar uppgifter för vår räkning:", processors("sv")] },
      {
        heading: "Dina rättigheter",
        blocks: [
          [
            "Du kan ladda ner alla dina uppgifter i inställningarna (JSON-fil). Det täcker rätten till tillgång och dataportabilitet.",
            "Du kan själv rätta ditt namn och dina markeringar.",
            "Du kan ta bort ditt konto och alla dina uppgifter i inställningarna.",
            "Du kan när som helst återkalla samtycket till veckomeddelandet.",
            "Du kan invända mot behandling som grundar sig på berättigat intresse genom att kontakta oss.",
            "Du kan lämna klagomål till dataombudsmannens byrå (tietosuoja.fi).",
          ],
        ],
      },
      { heading: "Ändringar", blocks: ["Vi berättar om väsentliga ändringar på den här sidan och uppdaterar datumet."] },
    ],
  };
}

function en(config: PrivacyConfig, updated: string): Policy {
  return {
    title: "Privacy policy",
    intro:
      "Aitio is a small, non-commercial service for logging and discovering theatre. We collect only what the service needs to work. We don't sell data, show ads or track you on other sites.",
    updated: `Updated ${updated}`,
    sections: [
      { heading: "Controller", blocks: [contactLine(config, "Controller and contact for data protection")] },
      {
        heading: "What we process and why",
        blocks: [
          [
            "Email address: to send sign-in codes and recognise your account. Basis: providing the service you asked for (GDPR Article 6(1)(b), contract).",
            "Name or nickname, if you give one: shown with your public reviews. Basis: the service (6(1)(b)).",
            "Your diary: shows you saw, dates, ratings, tags and the reviews you write. Basis: the service (6(1)(b)). A review you leave public appears on the show's page with your name. Ratings and tags are only shown to others as totals, without names.",
            "Your “Want to see” list: shows you saved to see, and when you saved them. Basis: the service (6(1)(b)). Only you can see the list, and a show leaves it when you log it as seen. If you get the weekly email, shows on your list come first in it.",
            "The weekly email about closing shows, if you sign up: your email address and the fact that you signed up. Basis: consent (6(1)(a)), which you can withdraw at any time from the link in the email or in your settings.",
            "Reports about reviews: who reported and why, so the same review can't be reported twice by one person. Basis: legitimate interest in keeping the service civil (6(1)(f)).",
            "Technical data: your sign-in session stores your IP address and browser identifier, and rate limiting keeps IP and email addresses for a short time. Basis: legitimate interest in security and preventing abuse (6(1)(f)).",
          ],
          "Your year in review and badges are calculated from your own entries each time you open the page, and only you can see them. We make no automated decisions and do no profiling.",
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          `We only use cookies needed for signing in (their names start with aitio.); one remembers your email address while you type the code, for ${SIGN_IN_MINUTES} minutes at most, and another keeps an entry you filled in before signing in, encrypted, for ${DRAFT_MINUTES} minutes at most. They don't need separate consent. We use no analytics, advertising or tracking cookies, and fonts are served from Aitio's own server.`,
        ],
      },
      {
        heading: "People in the credits",
        blocks: [
          "The names and roles of creators and performers on show pages come from the theatres' own websites (GDPR Article 14). The purpose is to tell who made a show. Basis: legitimate interest in compiling cultural information (6(1)(f)). We store only the name and role. If you want your name removed, contact us at the address below.",
        ],
      },
      {
        heading: "How long we keep data",
        blocks: [
          [
            "Account, diary, “Want to see” list and reviews: until you delete your account. Deleting it in the settings removes everything at once, public reviews included.",
            `Sign-in sessions: at most ${SESSION_DAYS} days; expired ones are deleted daily.`,
            `Sign-in codes (and the links that carry them): valid for ${SIGN_IN_MINUTES} minutes; expired ones are deleted daily. Only a hash of the code is stored.`,
            `Rate-limiting data: at most ${RATE_LIMIT_RETENTION_DAYS} days.`,
            `Database backups: deleted data is gone from them within ${BACKUP_DAYS} days.`,
            "Server logs: the hosting provider's short retention, a few days at most.",
          ],
        ],
      },
      { heading: "Who processes data for us", blocks: ["Only these providers process data on our behalf:", processors("en")] },
      {
        heading: "Your rights",
        blocks: [
          [
            "You can download all your data in the settings (a JSON file). This covers your rights of access and portability.",
            "You can correct your name and entries yourself.",
            "You can delete your account and all your data in the settings.",
            "You can withdraw consent to the weekly email at any time.",
            "You can object to processing based on legitimate interest by contacting us.",
            "You can complain to the Office of the Data Protection Ombudsman in Finland (tietosuoja.fi).",
          ],
        ],
      },
      { heading: "Changes", blocks: ["We'll describe significant changes on this page and update the date."] },
    ],
  };
}

const POLICIES: Record<Locale, (config: PrivacyConfig, updated: string) => Policy> = { fi, sv, en };

export function privacyPolicy(locale: Locale, config: PrivacyConfig, updated: string): Policy {
  return POLICIES[locale](config, updated);
}
