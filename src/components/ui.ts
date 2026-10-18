/** Shared class names so every action looks and feels the same (design system classes in globals.css). */
export const buttonPrimary = "ai-btn ai-btn--primary";
export const buttonSecondary = "ai-btn ai-btn--secondary";
export const buttonDanger = "ai-btn ai-btn--danger";
export const input =
  "min-h-tap w-full rounded-md border-2 border-rule-strong bg-paper-raised px-3 text-body focus:border-ink";
export const chip =
  "inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-rule-strong bg-paper-raised px-4 text-meta has-[:checked]:border-accent has-[:checked]:bg-accent-tint has-[:checked]:font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus";
/** A chip that is a link (the time choices): same shape, the current one marked like a checked chip. */
export const chipLink =
  "inline-flex min-h-tap items-center rounded-full border-[1.5px] border-rule-strong bg-paper-raised px-4 text-meta text-ink no-underline hover:border-ink hover:text-ink aria-[current=true]:border-accent aria-[current=true]:bg-accent-tint aria-[current=true]:font-bold";
