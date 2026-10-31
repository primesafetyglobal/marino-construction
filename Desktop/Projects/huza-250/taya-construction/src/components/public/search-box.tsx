"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { SearchResult } from "@/server/modules/catalog/search/search.select";

const KIND_LABEL = { equipment: "Equipment", product: "Material", service: "Service", training: "Training" } as const;

// Header live search: debounced GET /api/v1/catalog/search; picking one opens it.
export function SearchBox({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiGet<SearchResult>("/api/v1/catalog/search", { q }, { signal: ctrl.signal });
        if (res.ok) setResult(res.data as SearchResult);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const shown = q.trim().length >= 2 && result?.q === q.trim() ? result : null;
  const items = shown?.items ?? [];
  const go = (href: string, external: boolean) => {
    setOpen(false);
    onDone?.();
    if (external) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const pick = items[active];
          if (pick) return go(pick.href, pick.external);
          if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`, false);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, -1));
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search equipment, materials, services…"
          aria-label="Search"
          className="h-10 w-full rounded-full border border-line/70 bg-white/80 pr-9 pl-10 text-sm placeholder:text-muted focus:border-charcoal focus:ring-2 focus:ring-brand/40 focus:outline-none"
        />
        {loading && <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
      </form>
      {open && shown && (
        <div className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-2xl border border-line/60 bg-white shadow-lift animate-fade-up">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No matches. Press Enter to search everything.</p>
          ) : (
            <ul role="listbox">
              {items.map((it, i) => (
                <li key={`${it.kind}-${it.id}`}>
                  <button type="button" role="option" aria-selected={i === active} onClick={() => go(it.href, it.external)} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-mist", i === active && "bg-mist")}>
                    <span className="w-20 shrink-0 text-[11px] font-semibold tracking-wide text-muted uppercase">{KIND_LABEL[it.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.title}</span>
                      <span className="block truncate text-xs text-muted">{it.subtitle}</span>
                    </span>
                    {it.external && <ExternalLink className="h-3.5 w-3.5 text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`, false)} className="w-full border-t border-line/60 px-4 py-2.5 text-left text-sm font-semibold hover:bg-mist">
            See all results for “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
