import { getDictionary } from "@/i18n";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { type Block, POLICY_DATE, privacyConfig, privacyPolicy } from "@/lib/privacy";

export async function generateMetadata() {
  const { locale } = await getDictionary();
  const policy = privacyPolicy(locale, privacyConfig(), formatDate(POLICY_DATE, locale));
  return pageMetadata({ locale, section: "tietosuoja", title: policy.title, description: policy.intro });
}

function BlockView({ block }: { block: Block }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul className="list-disc space-y-2 pl-6">
      {block.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Static: the text only changes with a deploy. */
export default async function PrivacyPage() {
  const { locale } = await getDictionary();
  const policy = privacyPolicy(locale, privacyConfig(), formatDate(POLICY_DATE, locale));
  return (
    <article className="max-w-2xl space-y-8">
      <header className="space-y-3 border-b-4 border-double border-ink pb-4">
        <h1 className="text-4xl font-semibold sm:text-5xl">{policy.title}</h1>
        <p className="text-base text-ink-muted">{policy.updated}</p>
      </header>
      <p className="text-lg">{policy.intro}</p>
      {policy.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-2xl font-semibold">{section.heading}</h2>
          {section.blocks.map((block, index) => (
            <BlockView key={index} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}
