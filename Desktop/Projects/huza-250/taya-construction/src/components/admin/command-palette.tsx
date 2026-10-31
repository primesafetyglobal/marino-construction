"use client";
// Global search (⌘K / Ctrl K): jump to any page, or to a client, vendor or
// catalog item through the existing GET routes. Keyboard: arrows, Enter, Escape.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/sheet";

export type PaletteLink = { href: string; label: string; group: string };
type Hit = { href: string; label: string; meta?: string; group: string };

const ADMIN_HREF: Record<string, (id: string) => string> = {
  equipment: (id) => `/admin/catalog/equipment/${id}`,
  product: (id) => `/admin/catalog/products/${id}`,
  service: (id) => `/admin/catalog/services/${id}`,
  training: () => `/admin/catalog/trainings`,
};

export function CommandPalette({ open, onClose, links }: { open: boolean; onClose: () => void; links: PaletteLink[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pages = useMemo(() => {
    const s = q.trim().toLowerCase();
    return links.filter((l) => !s || l.label.toLowerCase().includes(s) || l.group.toLowerCase().includes(s)).slice(0, s ? 6 : 10);
  }, [q, links]);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) return;
    let stop = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const [clients, vendors, catalog] = await Promise.all([
        apiGet<{ items: { id: string; name: string; phone: string | null; companyName: string | null }[] }>("/api/v1/parties/client", { q: s, limit: 5 }),
        apiGet<{ items: { id: string; name: string; companyName: string | null; type: string }[] }>("/api/v1/parties/vendor", { q: s, limit: 5 }),
        apiGet<{ items: { kind: string; id: string; title: string; subtitle: string }[] }>("/api/v1/catalog/search", { q: s }),
      ]);
      if (stop) return;
      setLoading(false);
      const out: Hit[] = [];
      if (clients.ok) for (const c of (clients.data as { items: { id: string; name: string; phone: string | null; companyName: string | null }[] }).items) out.push({ href: `/admin/clients/${c.id}`, label: c.name, meta: c.companyName ?? c.phone ?? undefined, group: "Clients" });
      if (vendors.ok) for (const v of (vendors.data as { items: { id: string; name: string; companyName: string | null }[] }).items) out.push({ href: `/admin/vendors/${v.id}`, label: v.name, meta: v.companyName ?? undefined, group: "Vendors" });
      if (catalog.ok) for (const c of (catalog.data as { items: { kind: string; id: string; title: string; subtitle: string }[] }).items.slice(0, 6)) if (ADMIN_HREF[c.kind]) out.push({ href: ADMIN_HREF[c.kind](c.id), label: c.title, meta: c.subtitle, group: "Catalog" });
      setHits(out);
    }, 200);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [q]);

  const results: Hit[] = [...pages.map((p) => ({ ...p, group: `Pages · ${p.group}` })), ...(q.trim().length >= 2 ? hits : [])];
  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    setQ("");
    router.push(h.href);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Search the dashboard" size="lg">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={input}
          data-autofocus
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${active}` : undefined}
          aria-label="Search pages, clients, vendors and catalog"
          placeholder="Search pages, clients, vendors, equipment…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            if (e.target.value.trim().length < 2) setHits([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            }
            else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            }
          }}
          className="h-12 w-full rounded-[var(--radius-input)] border border-line-strong bg-white pr-3 pl-10 text-[15px] focus:border-charcoal focus:ring-3 focus:ring-brand/35 focus:outline-none"
        />
      </div>
      <ul id="palette-results" role="listbox" aria-label="Results" className="mt-3 max-h-[55vh] overflow-y-auto">
        {results.map((r, i) => (
          <li
            key={`${r.group}-${r.href}-${i}`}
            id={`palette-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(r)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm", i === active ? "bg-canvas" : "")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.label}</span>
              {r.meta && <span className="block truncate text-xs text-muted">{r.meta}</span>}
            </span>
            <span className="shrink-0 text-[11px] text-muted">{r.group}</span>
            {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted" aria-hidden />}
          </li>
        ))}
        {!results.length && <li className="px-3 py-8 text-center text-sm text-muted">{loading ? "Searching…" : "No match. Try a client name, a phone number or a machine."}</li>}
      </ul>
    </Dialog>
  );
}
