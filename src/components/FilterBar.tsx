import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { buttonPrimary, chip } from "@/components/ui";
import { type FilterOptions, type Filters, hasFilters } from "@/lib/catalogue/filters";

interface Group {
  name: keyof Filters;
  legend: string;
  values: Array<{ value: string; label: string }>;
}

function Chips({ group, selected, allLabel }: { group: Group; selected?: string; allLabel: string }) {
  const choices = [{ value: "", label: allLabel }, ...group.values];
  return (
    <fieldset>
      <legend className="ai-credits__group mt-0 mb-2">{group.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label key={choice.value || "all"} className={chip}>
            <input
              type="radio"
              name={group.name}
              value={choice.value}
              defaultChecked={(selected ?? "") === choice.value}
              className="sr-only"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A plain GET form: no client JavaScript, the URL is the state, shareable and back-button friendly. */
export function FilterBar({
  options,
  filters,
  locale,
  t,
}: {
  options: FilterOptions;
  filters: Filters;
  locale: Locale;
  t: Dictionary;
}) {
  const language = (code: string) => t.languages[code] ?? code.toUpperCase();
  const all: Group[] = [
    { name: "city", legend: t.filters.city, values: options.city.map((value) => ({ value, label: value })) },
    { name: "type", legend: t.filters.type, values: options.type.map((value) => ({ value, label: t.types[value] })) },
    { name: "lang", legend: t.filters.language, values: options.lang.map((value) => ({ value, label: language(value) })) },
    { name: "subs", legend: t.filters.subtitles, values: options.subs.map((value) => ({ value, label: language(value) })) },
  ];
  // A group with a single value can't narrow anything down, unless it is the active choice.
  const groups = all.filter((group) => group.values.length > 1 || filters[group.name] !== undefined);

  if (groups.length === 0) return null;
  return (
    <details open={hasFilters(filters)} className="group rounded-md border-[1.5px] border-rule-strong bg-paper-raised px-4 py-1">
      <summary className="flex min-h-tap-primary cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
        {t.filters.legend}
        <span aria-hidden="true" className="text-2xl transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form method="get" action={href(locale)} className="mt-1 mb-4 space-y-5">
        {groups.map((group) => (
          <Chips key={group.name} group={group} selected={filters[group.name]} allLabel={t.filters.all} />
        ))}
        <div className="ai-actions">
          <button type="submit" className={buttonPrimary}>
            {t.filters.apply}
          </button>
          {hasFilters(filters) && (
            <a href={href(locale)} className="inline-flex min-h-tap items-center justify-center">
              {t.filters.clear}
            </a>
          )}
        </div>
      </form>
    </details>
  );
}
