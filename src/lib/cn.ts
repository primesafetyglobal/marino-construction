// Joins class names, skipping falsy values. CLIENT-SAFE.
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
