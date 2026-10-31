// Display formats (Design §9). CLIENT-SAFE.
// Dates: "14 Oct 2026". A "YYYY-MM-DD" value is a calendar day and is shown as
// that day everywhere; an instant is shown in Kigali time.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const isDay = typeof value === "string" && DATE_ONLY.test(value);
  const date = typeof value === "string" ? new Date(isDay ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: isDay ? "UTC" : "Africa/Kigali",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kigali",
  }).format(date);
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? "-" : n.toLocaleString("en-US");
}

export function formatRwf(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? "-" : `RWF ${Math.round(amount).toLocaleString("en-US")}`;
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const m = phone.match(/^\+250(7\d{2})(\d{3})(\d{3})$/);
  return m ? `+250 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

// Today in Kigali, "YYYY-MM-DD" (for date inputs' min values).
export function todayKigali(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
