import { getDictionary } from "@/i18n";
import { type AboutSection, aboutPage } from "@/lib/about";
import { pageMetadata } from "@/lib/metadata";
import { privacyConfig } from "@/lib/privacy";
import { getListedTheatres } from "@/lib/catalogue/queries";
import type { Dictionary } from "@/i18n/dictionaries/fi";

export async function generateMetadata() {
  const { locale } = await getDictionary();
  const about = aboutPage(locale);
  return pageMetadata({ locale, section: "tietoa", title: about.title, description: about.intro });
}

type Theatre = Awaited<ReturnType<typeof getListedTheatres>>[number];

function Section({
  id,
  section,
  email,
  theatres,
  t,
}: {
  id: string;
  section: AboutSection;
  email: string;
  theatres: Theatre[];
  t: Dictionary;
}) {
  if (section.contact === "section" && !email) return null;
  return (
    <section aria-labelledby={id} className="ai-section space-y-3">
      <h2 id={id} className="ai-section__title">
        {section.heading}
      </h2>
      {section.blocks.map((block, index) => (
        <p key={index}>{block}</p>
      ))}
      {section.theatres && (
        <ul>
          {theatres.map((theatre) => (
            <li key={theatre.slug} className="ai-critic">
              <a href={theatre.website} rel="noopener external">
                <span>
                  <span className="ai-critic__outlet">{theatre.name}</span>
                  <span className="ai-critic__meta">{new URL(theatre.website).hostname.replace(/^www\./, "")}</span>
                  <span className="sr-only"> ({t.production.externalLink})</span>
                </span>
                <span className="ai-critic__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {section.contact && email && (
        <p>
          <a href={`mailto:${email}`} className="font-bold">
            {email}
          </a>
        </p>
      )}
    </section>
  );
}

/** Static: the text changes with a deploy, the theatre list with the catalogue. */
export default async function AboutPage() {
  const [{ locale, t }, theatres] = await Promise.all([getDictionary(), getListedTheatres()]);
  const about = aboutPage(locale);
  const { email } = privacyConfig();
  return (
    <article>
      <header className="space-y-3">
        <h1 className="text-display">{about.title}</h1>
        <p className="text-ink-muted">{about.intro}</p>
      </header>
      {about.sections.map((section, index) => (
        <Section key={section.heading} id={`about-${index}`} section={section} email={email} theatres={theatres} t={t} />
      ))}
    </article>
  );
}
