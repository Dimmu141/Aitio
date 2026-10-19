import type { Locale } from "@/i18n/config";
import { MIN_RATINGS_FOR_AVERAGE } from "@/lib/catalogue/select";
import type { Block } from "@/lib/privacy";

/**
 * The "about" page. Like the privacy policy it quotes the code's own rules (the
 * rating threshold, what the scraper keeps), so keep it true when those change.
 */
export interface AboutSection {
  heading: string;
  blocks: Block[];
  /** Render the list of theatres after this section's text. */
  theatres?: boolean;
  /**
   * The contact address after this section's text: "section" when the section is only
   * there to give it (left out without an address), "line" when it just ends with it.
   */
  contact?: "section" | "line";
}

export interface About {
  title: string;
  intro: string;
  sections: AboutSection[];
}

const n = MIN_RATINGS_FOR_AVERAGE;

const ABOUT: Record<Locale, About> = {
  fi: {
    title: "Tietoa Aitiosta",
    intro:
      "Aitio kokoaa pääkaupunkiseudun teattereiden, tanssitalojen ja oopperan ohjelmiston yhteen paikkaan. Samalla se on teatteripäiväkirja, johon voit merkitä näkemäsi esitykset, antaa niille tähtiä ja muistaa ne vielä vuosien päästä.",
    sections: [
      {
        heading: "Mistä tiedot tulevat",
        blocks: [
          "Haemme esitystiedot kerran päivässä teattereiden omilta verkkosivuilta: esitysten nimet, päivämäärät, näyttämöt, tekijät sekä linkit lippukauppaan ja arvosteluihin. Tallennamme vain tosiasiat. Emme kopioi esittelytekstejä, kuvia emmekä arvostelujen tekstejä.",
          "Jos jokin tieto on väärin, teatterin oma sivu on aina oikeassa. Jokaisen esityksen sivun lopussa on linkki lähteeseen.",
        ],
        theatres: true,
      },
      {
        heading: "Liput",
        blocks: [
          "Aitio ei myy lippuja. Liput-linkit vievät suoraan teatterin omaan lippukauppaan, ja ostat lippusi sieltä niin kuin ennenkin.",
        ],
      },
      {
        heading: "Katsojien arviot",
        blocks: [
          `Tähdet ja tunnisteet tulevat Aition käyttäjiltä, jotka ovat merkinneet esityksen nähdyksi. Keskiarvo näytetään vasta, kun arvioita on vähintään ${n}, jotta muutama ääni ei yksin määrää kuvaa.`,
          "Kirjoitetut arviot ovat oletuksena julkisia, mutta kirjoittaja voi pitää arvionsa omana tietonaan. Asiattomasta arviosta voi ilmoittaa, ja tarkistamme jokaisen ilmoituksen.",
        ],
      },
      {
        heading: "Kriitikot ja blogit",
        blocks: [
          "Linkitämme lehtien arvosteluihin ja bloggaajien kirjoituksiin niiden alkuperäisille sivuille. Emme lainaa niitä emmekä laske niistä pisteitä. Lehdet ja blogit näytetään erikseen.",
        ],
      },
      {
        heading: "Teattereille",
        blocks: [
          "Hakurobottimme kertoo nimensä ja yhteystietonsa jokaisessa pyynnössä, noudattaa robots.txt-tiedostoa ja hakee enintään yhden sivun sekunnissa samalta palvelimelta. Jos haluatte korjata jotain tai että lopetamme tietojenne hakemisen, kirjoittakaa meille.",
        ],
        contact: "line",
      },
      {
        heading: "Palaute ja korjaukset",
        blocks: ["Virheet, toiveet ja kysymykset otetaan ilolla vastaan."],
        contact: "section",
      },
    ],
  },
  sv: {
    title: "Om Aitio",
    intro:
      "Aitio samlar repertoaren på huvudstadsregionens teatrar, danshus och opera på ett ställe. Det är också en teaterdagbok där du kan markera föreställningar du sett, ge dem stjärnor och minnas dem många år senare.",
    sections: [
      {
        heading: "Varifrån uppgifterna kommer",
        blocks: [
          "En gång om dagen hämtar vi uppgifterna från teatrarnas egna webbplatser: titlar, datum, scener, upphovspersoner och länkar till biljettbutiken och till recensioner. Vi sparar bara fakta. Vi kopierar inga presentationstexter, bilder eller recensionstexter.",
          "Om något är fel har teaterns egen sida alltid rätt. Längst ner på varje föreställnings sida finns en länk till källan.",
        ],
        theatres: true,
      },
      {
        heading: "Biljetter",
        blocks: [
          "Aitio säljer inga biljetter. Biljettlänkarna leder direkt till teaterns egen biljettbutik, där du köper din biljett som vanligt.",
        ],
      },
      {
        heading: "Publikens betyg",
        blocks: [
          `Stjärnorna och taggarna kommer från Aitios användare som har markerat föreställningen som sedd. Medelvärdet visas först när det finns minst ${n} betyg, så att några få röster inte ensamma avgör bilden.`,
          "Skrivna recensioner är offentliga som standard, men skribenten kan välja att hålla sin för sig själv. Man kan anmäla en olämplig recension, och vi går igenom varje anmälan.",
        ],
      },
      {
        heading: "Kritiker och bloggar",
        blocks: [
          "Vi länkar till tidningarnas recensioner och till bloggtexter på deras ursprungliga sidor. Vi citerar dem inte och räknar inga poäng ur dem. Tidningar och bloggar visas separat.",
        ],
      },
      {
        heading: "Till teatrarna",
        blocks: [
          "Vår sökrobot uppger sitt namn och sina kontaktuppgifter i varje förfrågan, följer robots.txt och hämtar högst en sida i sekunden från samma server. Om ni vill rätta något eller vill att vi slutar hämta era uppgifter, skriv till oss.",
        ],
        contact: "line",
      },
      {
        heading: "Respons och rättelser",
        blocks: ["Fel, önskemål och frågor tas gärna emot."],
        contact: "section",
      },
    ],
  },
  en: {
    title: "About Aitio",
    intro:
      "Aitio brings the programmes of the Helsinki region's theatres, dance houses and opera together in one place. It is also a theatre diary: log the shows you've seen, rate them, and still remember them years later.",
    sections: [
      {
        heading: "Where the listings come from",
        blocks: [
          "Once a day we collect the listings from the theatres' own websites: titles, dates, stages, credits, and links to the box office and to reviews. We keep facts only. We don't copy promotional texts, images or review texts.",
          "If something is wrong, the theatre's own page is always right. Every show's page ends with a link to its source.",
        ],
        theatres: true,
      },
      {
        heading: "Tickets",
        blocks: [
          "Aitio doesn't sell tickets. The ticket links go straight to the theatre's own box office, where you buy as you always have.",
        ],
      },
      {
        heading: "Audience ratings",
        blocks: [
          `The stars and tags come from Aitio users who have logged the show as seen. The average only appears once there are at least ${n} ratings, so a handful of votes can't decide the picture.`,
          "Written reviews are public by default, but their author can keep theirs private. Anyone can report an inappropriate review, and we check every report.",
        ],
      },
      {
        heading: "Critics and blogs",
        blocks: [
          "We link to newspaper reviews and blog posts on their original sites. We don't quote them or turn them into scores. Press and blogs are listed separately.",
        ],
      },
      {
        heading: "For theatres",
        blocks: [
          "Our crawler states its name and contact details with every request, follows robots.txt and fetches at most one page a second from a server. If you want something corrected, or want us to stop collecting your listings, write to us.",
        ],
        contact: "line",
      },
      {
        heading: "Feedback and corrections",
        blocks: ["Mistakes, wishes and questions are all welcome."],
        contact: "section",
      },
    ],
  },
};

export function aboutPage(locale: Locale): About {
  return ABOUT[locale];
}
