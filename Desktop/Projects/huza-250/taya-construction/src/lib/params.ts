// URL search params → a flat object of strings (first value wins). CLIENT-SAFE.
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function flatParams(sp: RawSearchParams, keep?: readonly string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (keep && !keep.includes(k)) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out[k] = value;
  }
  return out;
}
