"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, UserCheck, X } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { STATUS_LABEL } from "@/server/modules/operations/operations.status";
import type { ActionResult } from "@/server/core/result";
import { setEquipmentRequestHandler, setEquipmentRequestStatus } from "@/server/modules/operations/equipment-request/equipment-request.actions";
import { setSupplyOrderHandler, setSupplyOrderStatus, updateSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.actions";
import { setServiceRequestHandler, setServiceRequestStatus, updateServiceRequest } from "@/server/modules/operations/service-request/service-request.actions";
import { setWorkforceRequestHandler, setWorkforceRequestStatus } from "@/server/modules/operations/workforce-request/workforce-request.actions";

export type RequestKind = "equipment" | "supply" | "service" | "workforce";

// Runs a (bound) server action, with an optional confirm dialog, a toast and a refresh.
export function ActionButton({
  action,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  success = "Saved.",
  redirectTo,
  testId,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "dark" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  success?: string;
  redirectTo?: string;
  testId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);
  async function run() {
    setAsking(false);
    setPending(true);
    const r = await action();
    setPending(false);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", success);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }
  return (
    <>
      <Button variant={variant} size={size} disabled={pending} onClick={() => (confirm ? setAsking(true) : run())} data-testid={testId}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title="Please confirm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant={variant === "danger" ? "danger" : "dark"} onClick={run}>
              Confirm
            </Button>
          </>
        }
      >
        <p>{confirm}</p>
      </Dialog>
    </>
  );
}

const SET_STATUS = {
  equipment: setEquipmentRequestStatus,
  supply: setSupplyOrderStatus,
  service: setServiceRequestStatus,
  workforce: setWorkforceRequestStatus,
} as const;

const SET_HANDLER = {
  equipment: setEquipmentRequestHandler,
  supply: setSupplyOrderHandler,
  service: setServiceRequestHandler,
  workforce: setWorkforceRequestHandler,
} as const;

// Status stepper: the path so far, and only the moves the server would accept.
export function StatusStepper({ kind, requestId, status, path, moves }: { kind: RequestKind; requestId: string; status: string; path: string[]; moves: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const current = path.indexOf(status);

  async function move(to: string) {
    setConfirmCancel(null);
    setPending(to);
    const r = await (SET_STATUS[kind] as (i: { id: string; status: string }) => Promise<ActionResult<unknown>>)({ id: requestId, status: to });
    setPending(null);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", `Moved to ${STATUS_LABEL[to] ?? to}.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-y-2">
        {path.map((s, i) => (
          <li key={s} className="flex items-center">
            <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", s === status ? "bg-charcoal text-white" : i < current ? "bg-success-tint text-success" : "bg-mist text-muted")}>
              {i < current && <Check className="h-3 w-3" />}
              {STATUS_LABEL[s] ?? s}
            </span>
            {i < path.length - 1 && <span className="mx-1 h-px w-4 bg-line" />}
          </li>
        ))}
        {!path.includes(status) && <li className="ml-2 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-muted">{STATUS_LABEL[status] ?? status}</li>}
      </ol>
      {moves.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moves.map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === "CANCELLED" || to === "CLOSED" ? "danger" : "dark"}
              disabled={!!pending}
              onClick={() => (to === "CANCELLED" || to === "CLOSED" ? setConfirmCancel(to) : move(to))}
              data-testid={`move-${to}`}
            >
              {pending === to && <Loader2 className="h-4 w-4 animate-spin" />}
              {to === "CANCELLED" ? "Cancel request" : to === "CLOSED" ? "Close request" : `Mark ${STATUS_LABEL[to]?.toLowerCase() ?? to}`}
            </Button>
          ))}
        </div>
      )}
      <Dialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Please confirm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => confirmCancel && move(confirmCancel)}>
              Yes, {confirmCancel === "CLOSED" ? "close" : "cancel"} it
            </Button>
          </>
        }
      >
        <p>Requests are never deleted. This keeps it in the history as {confirmCancel === "CLOSED" ? "closed" : "cancelled"}.</p>
      </Dialog>
    </div>
  );
}

// An autocomplete over one of our GET routes.
export function EntityPicker<T extends { id: string }>({
  endpoint,
  params,
  label,
  labelOf,
  detailOf,
  onPick,
  placeholder = "Search…",
  testId,
}: {
  endpoint: `/api/${string}`;
  params?: Record<string, string>;
  label: string;
  labelOf: (row: T) => string;
  detailOf?: (row: T) => string;
  onPick: (row: T) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiGet<{ items: T[] }>(endpoint, { ...JSON.parse(paramsKey), q: q || undefined, limit: 8 }, { signal: ctrl.signal });
        if (res.ok) setRows(res.data.items as unknown as T[]);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open, endpoint, paramsKey]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        aria-label={label}
        data-testid={testId}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-white pr-3 pl-9 text-sm focus:border-charcoal focus:ring-2 focus:ring-brand/40 focus:outline-none"
      />
      {open && (
        <ul className="absolute top-11 right-0 left-0 z-20 max-h-72 overflow-y-auto rounded-xl border border-line/60 bg-white py-1 shadow-lift">
          {loading && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
          {!loading && rows.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-mist"
                onClick={() => {
                  onPick(r);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="block font-medium">{labelOf(r)}</span>
                {detailOf && <span className="block text-xs text-muted">{detailOf(r)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "Who is handling this?" (OPS-R14): the active users picker, or "assign to me".
export function HandlerPicker({ kind, requestId, current, me, canEdit }: { kind: RequestKind; requestId: string; current: { id: string; name: string } | null; me: { id: string; name: string }; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  async function assign(id: string | null) {
    setPending(true);
    const r = await (SET_HANDLER[kind] as (i: { id: string; handledById: string | null }) => Promise<ActionResult<unknown>>)({ id: requestId, handledById: id });
    setPending(false);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", id ? "Handler set." : "Handler removed.");
    router.refresh();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm">{current ? <strong>{current.name}</strong> : <span className="text-muted">Nobody yet</span>}</p>
        {canEdit && current && (
          <Button size="sm" variant="ghost" onClick={() => assign(null)} disabled={pending} aria-label="Remove handler">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {canEdit && (
        <>
          {current?.id !== me.id && (
            <Button size="sm" variant="dark" className="w-full" onClick={() => assign(me.id)} disabled={pending} data-testid="assign-me">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Assign to me
            </Button>
          )}
          <EntityPicker<{ id: string; name: string }> endpoint="/api/v1/access/user" params={{ picker: "1" }} label="Choose a handler" placeholder="Choose someone else…" labelOf={(u) => u.name} onPick={(u) => assign(u.id)} />
        </>
      )}
    </div>
  );
}

// Linking an APPROVED vendor to a supply order or service request (OPS-R8).
export function VendorPicker({ kind, requestId, current, canEdit }: { kind: "supply" | "service"; requestId: string; current: { id: string; name: string; companyName: string | null; phone: string | null; email: string | null; isPartner: boolean } | null; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  async function link(vendorId: string | null) {
    const update = (kind === "supply" ? updateSupplyOrder : updateServiceRequest) as (i: { id: string; vendorId: string | null }) => Promise<ActionResult<unknown>>;
    const r = await update({ id: requestId, vendorId });
    if (!r.ok) return toast("error", r.error.message);
    toast("success", vendorId ? "Vendor linked." : "Vendor removed.");
    router.refresh();
  }
  return (
    <div className="space-y-3">
      {current ? (
        <div className="text-sm">
          <a href={`/admin/vendors/${current.id}`} className="font-semibold hover:underline">
            {current.companyName ?? current.name}
          </a>
          {current.isPartner && <span className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold">Approved Partner</span>}
          <p className="text-muted">{[current.phone, current.email].filter(Boolean).join(" · ")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">No vendor linked.</p>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <div className="flex-1">
            <EntityPicker<{ id: string; name: string; companyName: string | null; type: string; district: string | null }>
              endpoint="/api/v1/parties/vendor"
              params={{ status: "APPROVED" }}
              label="Link a vendor"
              placeholder={current ? "Change vendor…" : "Link an approved vendor…"}
              labelOf={(v) => v.companyName ?? v.name}
              detailOf={(v) => [v.type.replace("_", " ").toLowerCase(), v.district].filter(Boolean).join(" · ")}
              onPick={(v) => link(v.id)}
            />
          </div>
          {current && (
            <Button size="sm" variant="ghost" onClick={() => link(null)} aria-label="Remove vendor">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
