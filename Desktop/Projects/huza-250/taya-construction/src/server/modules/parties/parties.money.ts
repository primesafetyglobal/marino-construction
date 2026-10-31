// parties.money.ts, no server-only: payment screens use it in the browser.
// Money is Int RWF (D-5): whole francs, so integer sums are exact.

export function formatRwf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return `RWF ${Math.round(amount).toLocaleString("en-US")}`;
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
