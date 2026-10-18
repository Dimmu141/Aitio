import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/Badge";
import { Notice } from "@/components/Notice";
import { PosterSmall } from "@/components/Poster";
import { Section } from "@/components/Section";
import { t } from "@/i18n/fi";
import { helsinkiYear } from "@/lib/format";
import { getPerson, type PersonCredit } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/henkilo/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPerson(slug);
  if (!result.ok || !result.data) return {};
  return {
    title: result.data.name,
    description: `${result.data.name}: roolit ja työt suomalaisissa teattereissa.`,
    alternates: { canonical: `/henkilo/${slug}` },
  };
}

function rolesText(credit: PersonCredit): string {
  return credit.roles
    .map((role) => (role.role === "CAST" ? (role.characterName ?? t.role.CAST) : t.role[role.role]))
    .join(", ");
}

function CreditRow({ credit }: { credit: PersonCredit }) {
  const { production } = credit;
  return (
    <li className="border-b border-rule py-4">
      <Link href={`/esitys/${production.slug}`} className="flex gap-4 text-ink no-underline">
        <PosterSmall slug={production.slug} title={production.title} />
        <div className="grid content-start gap-1">
          <h3 className="text-card-title underline decoration-rule-strong decoration-1 underline-offset-4">{production.title}</h3>
          <p className="text-meta text-ink-muted">
            {production.theatre}
            {production.year && ` · ${helsinkiYear(production.year)}`}
          </p>
          <p className="text-meta">{rolesText(credit)}</p>
          {production.upcoming && (
            <span>
              <Badge variant="quiet">{t.programme.title}</Badge>
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

async function PersonView({ params }: Pick<PageProps<"/henkilo/[slug]">, "params">) {
  const { slug } = await params;
  const result = await getPerson(slug);
  if (!result.ok) return <Notice>{t.site.unavailable}</Notice>;
  const person = result.data;
  if (!person) notFound();

  return (
    <>
      <h1 className="text-display">{person.name}</h1>
      <p className="mt-2 text-ink-muted">{t.person.lead}</p>
      <Section title={t.person.productions} aside={t.programme.count(person.credits.length)}>
        <ul className="border-t border-rule">
          {person.credits.map((credit) => (
            <CreditRow key={credit.production.slug} credit={credit} />
          ))}
        </ul>
      </Section>
    </>
  );
}

export default function PersonPage({ params }: PageProps<"/henkilo/[slug]">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.site.loading}</p>}>
      <PersonView params={params} />
    </Suspense>
  );
}
