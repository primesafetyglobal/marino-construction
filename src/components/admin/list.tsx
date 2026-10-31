"use client";

// Admin lists: the first page comes from the Server Component; filters,
// search and "Load more" fetch from the GET route with the same URL params,
// and the URL is kept in sync (Architecture §4).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, NoAccess } from "@/components/ui/states";
import { RowsSkeleton } from "@/components/ui/skeleton";

export type Params = Record<string, string | undefined>;
// mono: codes, amounts, dates (tabular). primary: the card title on phones.
export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string; mono?: boolean; primary?: boolean };
export type Filter = { name: string; label: string; type: "search" } | { name: string; label: string; type: "select"; options: { value: string; label: string }[] };

export function useApiList<T extends { id: string }>(endpoint: `/api/${string}`, initial: { items: T[]; nextCursor: string | null }, initialParams: Params) {
  const [items, setItems] = useState<T[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [params, setParams] = useState<Params>(initialParams);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const first = useRef(true);

  const fetchPage = useCallback(
    async (p: Params, after?: string | null) => {
      setLoading(true);
      setError(null);
      const res = await apiGet<{ items: T[]; nextCursor: string | null }>(endpoint, { ...p, cursor: after ?? undefined });
      setLoading(false);
      if (!res.ok) return setError(res.error);
      const data = res.data as unknown as { items: T[]; nextCursor: string | null };
      setItems((prev) => (after ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    },
    [endpoint],
  );

  // router.refresh() after an action sends a new first page: show it.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setItems(initial.items);
    setCursor(initial.nextCursor);
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    window.history.replaceState(null, "", `${window.location.pathname}${sp.toString() ? `?${sp}` : ""}`);
    const t = setTimeout(() => fetchPage(params), params.q !== undefined ? 250 : 0);
    return () => clearTimeout(t);
  }, [params, fetchPage]);

  return {
    items,
    setItems,
    params,
    setParam: (name: string, value: string | undefined) => setParams((p) => ({ ...p, [name]: value || undefined })),
    loadMore: () => fetchPage(params, cursor),
    reload: () => fetchPage(params),
    hasMore: !!cursor,
    loading,
    error,
  };
}

// Toolbar: search, filter selects, extra controls (view toggle, sort), result count.
// Filters stay in URL params (useApiList keeps the URL in sync).
export function FilterBar({ filters, params, setParam, children, count }: { filters: Filter[]; params: Params; setParam: (n: string, v: string | undefined) => void; children?: ReactNode; count?: ReactNode }) {
  const active = filters.filter((f) => f.type === "select" && params[f.name]);
  return (
    <div className="mb-4 space-y-2">
      <div className="no-scrollbar -mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 py-0.5">
        {filters.map((f) =>
          f.type === "search" ? (
            <div key={f.name} className="relative min-w-52 flex-1 shrink-0 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input aria-label={f.label} placeholder={f.label} type="search" className="h-10 pl-9" defaultValue={params[f.name] ?? ""} onChange={(e) => setParam(f.name, e.target.value)} />
            </div>
          ) : (
            <Select key={f.name} aria-label={f.label} className={cn("h-10 w-auto min-w-36 shrink-0", params[f.name] && "border-charcoal bg-brand-tint/40")} value={params[f.name] ?? ""} onChange={(e) => setParam(f.name, e.target.value)}>
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ),
        )}
        {children}
        {count !== undefined && <span className="num ml-auto shrink-0 pl-2 text-xs whitespace-nowrap text-muted">{count}</span>}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((f) => {
            const opt = f.type === "select" ? f.options.find((o) => o.value === params[f.name]) : null;
            return (
              <button key={f.name} onClick={() => setParam(f.name, undefined)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-xs hover:border-ink/30">
                <span className="text-muted">{f.label}:</span> {opt?.label ?? params[f.name]}
                <X className="h-3 w-3" aria-label={`Clear ${f.label}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  list,
  empty,
  onRowHref,
}: {
  columns: Column<T>[];
  list: ReturnType<typeof useApiList<T>>;
  empty: { title: string; action?: ReactNode };
  onRowHref?: (row: T) => string;
}) {
  const router = useRouter();
  if (list.error?.code === "FORBIDDEN") return <NoAccess />;
  if (list.error && !list.items.length) return <ErrorState message={list.error.message} retry={<Button onClick={list.reload}>Try again</Button>} />;
  if (list.loading && !list.items.length) return <RowsSkeleton />;
  if (!list.items.length) return <EmptyState title={empty.title} action={empty.action} />;
  const go = (row: T, e: React.MouseEvent) => {
    if (!onRowHref || (e.target as HTMLElement).closest("a,button,select,input,label")) return;
    router.push(onRowHref(row));
  };
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-opacity", list.loading && "opacity-70")} aria-busy={list.loading || undefined}>
      {/* Phones: rows collapse to cards. */}
      <ul className="divide-y divide-line md:hidden">
        {list.items.map((row) => (
          <li key={row.id} className={cn("px-4 py-3.5", onRowHref && "cursor-pointer active:bg-canvas")} onClick={(e) => go(row, e)}>
            <div className="mb-2 min-w-0 font-medium">{primary.cell(row)}</div>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[13px]">
              {columns
                .filter((c) => c !== primary && c.header)
                .map((c) => (
                  <div key={c.header} className="contents">
                    <dt className="text-muted">{c.header}</dt>
                    <dd className={cn("min-w-0", c.mono && "num")}>{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-canvas text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn("px-4 py-2.5 whitespace-nowrap", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.items.map((row) => (
              <tr key={row.id} className={cn("transition-colors duration-150 hover:bg-canvas/70", onRowHref && "cursor-pointer")} onClick={(e) => go(row, e)}>
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-4 py-3 align-middle", c.mono && "num", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(list.hasMore || list.error) && (
        <div className="flex items-center justify-center gap-3 border-t border-line py-3">
          {list.error && <span className="text-sm text-danger">{list.error.message}</span>}
          {list.hasMore && (
            <Button variant="outline" size="sm" onClick={list.loadMore} disabled={list.loading}>
              {list.loading && <Loader2 className="h-4 w-4 animate-spin" />} Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
