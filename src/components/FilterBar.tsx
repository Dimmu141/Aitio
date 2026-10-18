import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fi";
import { href } from "@/i18n/paths";
import { buttonPrimary, chip, chipLink } from "@/components/ui";
import { ENGLISH_FRIENDLY, type FilterOptions, type Filters, filterQuery, hasFilters } from "@/lib/catalogue/filters";

/** The choices inside the panel; the time chips sit outside it, one tap each. */
const PANEL_KEYS = ["city", "type", "lang", "subs"] as const satisfies ReadonlyArray<keyof Filters>;

interface Group {
  name: (typeof PANEL_KEYS)[number];
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
  const spoken = (code: string) => (code === ENGLISH_FRIENDLY ? t.filters.english : language(code));
  const all: Group[] = [
    { name: "city", legend: t.filters.city, values: options.city.map((value) => ({ value, label: value })) },
    { name: "type", legend: t.filters.type, values: options.type.map((value) => ({ value, label: t.types[value] })) },
    { name: "lang", legend: t.filters.language, values: options.lang.map((value) => ({ value, label: spoken(value) })) },
    { name: "subs", legend: t.filters.subtitles, values: options.subs.map((value) => ({ value, label: language(value) })) },
  ];
  // A group with a single value can't narrow anything down, unless it is the active choice.
  const groups = all.filter((group) => group.values.length > 1 || filters[group.name] !== undefined);

  if (groups.length === 0) return null;
  return (
    <details open={hasFilters(filters, PANEL_KEYS)} className="group rounded-md border-[1.5px] border-rule-strong bg-paper-raised px-4 py-1">
      <summary className="flex min-h-tap-primary cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
        {t.filters.legend}
        <span aria-hidden="true" className="text-2xl transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form method="get" action={href(locale)} className="mt-1 mb-4 space-y-5">
        {filters.when && <input type="hidden" name="when" value={filters.when} />}
        {groups.map((group) => (
          <Chips key={group.name} group={group} selected={filters[group.name]} allLabel={t.filters.all} />
        ))}
        <div className="ai-actions">
          <button type="submit" className={buttonPrimary}>
            {t.filters.apply}
          </button>
          {hasFilters(filters, PANEL_KEYS) && (
            <a href={`${href(locale)}${filterQuery(filters, { city: undefined, type: undefined, lang: undefined, subs: undefined })}`} className="inline-flex min-h-tap items-center justify-center">
              {t.filters.clear}
            </a>
          )}
        </div>
      </form>
    </details>
  );
}

/** Today, tomorrow, the weekend: plain links that keep the other choices, so one tap is enough. */
export function WhenChips({
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
  if (options.when.length === 0) return null;
  const choices = [
    { value: undefined, label: t.filters.whenAll },
    ...options.when.map((value) => ({ value, label: t.filters.whenLabels[value] })),
  ];
  return (
    <nav aria-label={t.filters.when}>
      <ul className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <li key={choice.value ?? "all"}>
            <a
              href={`${href(locale)}${filterQuery(filters, { when: choice.value })}`}
              className={chipLink}
              aria-current={filters.when === choice.value ? "true" : undefined}
            >
              {choice.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
