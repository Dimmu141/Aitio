/** Half-star rating as text stars with a spoken label: 7 → "★★★½". */
export function starText(halfStars: number): string {
  return "★".repeat(Math.floor(halfStars / 2)) + (halfStars % 2 === 1 ? "½" : "");
}

export function Stars({ halfStars, label }: { halfStars: number; label: string }) {
  return (
    <span className="whitespace-nowrap text-accent">
      <span aria-hidden="true">{starText(halfStars)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
