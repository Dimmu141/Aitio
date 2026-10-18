import Link from "next/link";
import { ProductionType } from "@/generated/prisma/enums";
import { t } from "@/i18n/fi";
import { hasFilters, LANGUAGE_CODES, type Filters } from "@/lib/filters";

type Option = { value: string; label: string };

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: Option[] }) {
  return (
    <label className="grid gap-1">
      <span className="text-meta font-bold">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-tap w-full rounded-md border-2 border-rule-strong bg-paper-raised px-3 text-ink"
      >
        <option value="">{t.filters.any}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const languageOptions: Option[] = LANGUAGE_CODES.map((code) => ({ value: code, label: t.languageName[code] ?? code }));
const typeOptions: Option[] = Object.values(ProductionType)
  .filter((type) => type !== "OTHER")
  .map((type) => ({ value: type.toLowerCase(), label: t.type[type] }));

/** A plain GET form: works without JavaScript, and every result is a shareable URL. */
export function FilterBar({ filters, cities }: { filters: Filters; cities: string[] }) {
  return (
    // Folded by default so the programme, not the form, fills the first screen.
    <details open={hasFilters(filters)} className="group rounded-md border border-rule bg-paper-raised">
      <summary className="flex min-h-tap cursor-pointer items-center justify-between px-4 font-bold marker:content-none">
        {t.filters.legend}
        <span aria-hidden="true" className="text-accent group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form method="get" action="/" className="px-4 pb-4">
        <fieldset>
          <legend className="sr-only">{t.filters.legend}</legend>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <Select name="kaupunki" label={t.filters.city} value={filters.city} options={cities.map((city) => ({ value: city, label: city }))} />
            <Select name="tyyppi" label={t.filters.type} value={filters.type?.toLowerCase()} options={typeOptions} />
            <Select name="kieli" label={t.filters.language} value={filters.language} options={languageOptions} />
            <Select name="tekstitys" label={t.filters.subtitles} value={filters.subtitles} options={languageOptions} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="submit" className="min-h-tap rounded-md bg-accent px-6 text-button text-on-accent hover:bg-accent-strong">
              {t.filters.submit}
            </button>
            {hasFilters(filters) && <Link href="/">{t.filters.clear}</Link>}
          </div>
        </fieldset>
      </form>
    </details>
  );
}
