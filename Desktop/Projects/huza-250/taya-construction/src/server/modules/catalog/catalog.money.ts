// catalog.money.ts, no server-only: cards and forms use it in the browser.
// Money is Int RWF (D-5): whole francs, no decimals, so plain integers are exact.

export const RENT_UNIT_LABEL: Record<string, string> = { DAY: "day", WEEK: "week", MONTH: "month", PROJECT: "project" };
export const PRODUCT_UNIT_LABEL: Record<string, string> = {
  PIECE: "piece",
  BAG: "bag",
  M2: "m²",
  M3: "m³",
  TON: "ton",
  LITRE: "litre",
  TRIP: "trip",
};

// 150000 → "RWF 150,000"
export function formatRwf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Price on request";
  return `RWF ${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatRwfPer(amount: number | null | undefined, unit: string | null | undefined, labels = RENT_UNIT_LABEL) {
  if (amount === null || amount === undefined) return "Price on request";
  return unit ? `${formatRwf(amount)} / ${labels[unit] ?? unit.toLowerCase()}` : formatRwf(amount);
}
