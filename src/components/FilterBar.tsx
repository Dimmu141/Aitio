import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
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
      <legend className="mb-1 font-semibold">{group.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value || "all"}
            className="inline-flex min-h-tap cursor-pointer items-center rounded-full border border-rule bg-paper px-4 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
          >
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
    <details open={hasFilters(filters)} className="group rounded border border-rule bg-card p-4">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        {t.filters.legend}
        <span aria-hidden="true" className="text-2xl transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form method="get" action={href(locale)} className="mt-3 space-y-5">
        {groups.map((group) => (
          <Chips key={group.name} group={group} selected={filters[group.name]} allLabel={t.filters.all} />
        ))}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="min-h-tap rounded bg-accent px-6 text-lg font-semibold text-paper hover:bg-ink"
          >
            {t.filters.apply}
          </button>
          {hasFilters(filters) && (
            <a href={href(locale)} className="inline-flex min-h-tap items-center">
              {t.filters.clear}
            </a>
          )}
        </div>
      </form>
    </details>
  );
}
