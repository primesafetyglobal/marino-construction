"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatRwf, humanize, todayKigali } from "@/lib/format";
import { useActionForm } from "@/lib/forms";
import type { Jsonify } from "@/server/core/result";
import { createInstallmentPlan, deletePayment, markPaymentPaid, recordPayment } from "@/server/modules/parties/payment/payment.actions";
import { createInstallmentPlanSchema, markPaymentPaidSchema, recordPaymentSchema } from "@/server/modules/parties/payment/payment.schema";
import type { RequestPayments } from "@/server/modules/parties/payment/payment.select";
import type { PayableType } from "@/server/modules/parties/parties.select";

const METHODS = [
  { value: "MOMO", label: "Mobile money" },
  { value: "BANK", label: "Bank" },
  { value: "CASH", label: "Cash" },
];

export function PaymentsPanel({
  requestType,
  requestId,
  data,
  canRecord,
  canDelete,
  installmentsAllowed,
}: {
  requestType: PayableType;
  requestId: string;
  data: Jsonify<RequestPayments>;
  canRecord: boolean;
  canDelete: boolean;
  installmentsAllowed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"record" | "plan" | { pay: string } | null>(null);
  const s = data.summary;

  async function remove(id: string) {
    const r = await deletePayment({ id });
    if (!r.ok) return toast("error", r.error.message);
    toast("success", "Payment deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-mist p-3">
          <dt className="text-muted">Quoted</dt>
          <dd className="font-semibold">{formatRwf(s.quotedAmount)}</dd>
        </div>
        <div className="rounded-xl bg-success-tint p-3">
          <dt className="text-muted">Paid</dt>
          <dd className="font-semibold text-success" data-testid="paid-total">
            {formatRwf(s.paid)}
          </dd>
        </div>
        <div className="rounded-xl bg-mist p-3">
          <dt className="text-muted">Outstanding</dt>
          <dd className="font-semibold">{formatRwf(s.outstanding)}</dd>
        </div>
        <div className={s.overdue ? "rounded-xl bg-danger-tint p-3" : "rounded-xl bg-mist p-3"}>
          <dt className="text-muted">Overdue</dt>
          <dd className={s.overdue ? "font-semibold text-danger" : "font-semibold"}>{formatRwf(s.overdue)}</dd>
        </div>
      </dl>

      {data.items.length > 0 ? (
        <ul className="divide-y divide-line/50 rounded-xl border border-line/50">
          {data.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{formatRwf(p.amount)}</p>
                <p className="text-xs text-muted">
                  {p.status === "PAID" ? `Paid ${formatDate(p.paidAt)} · ${humanize(p.method)}${p.reference ? ` · ${p.reference}` : ""}` : `Due ${formatDate(p.dueDate)}`}
                </p>
              </div>
              <StatusPill status={p.isOverdue ? "OVERDUE" : p.status} />
              {canRecord && p.status === "DUE" && (
                <Button size="sm" variant="outline" onClick={() => setDialog({ pay: p.id })}>
                  Mark paid
                </Button>
              )}
              {canDelete && p.status === "DUE" && (
                <Button size="sm" variant="ghost" aria-label="Delete payment" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No payments yet.</p>
      )}

      {canRecord && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="dark" onClick={() => setDialog("record")}>
            <Plus className="h-4 w-4" /> Record payment
          </Button>
          {installmentsAllowed && (
            <Button size="sm" variant="outline" onClick={() => setDialog("plan")} data-testid="plan-open">
              Create installment plan
            </Button>
          )}
        </div>
      )}

      {dialog === "record" && <RecordDialog requestType={requestType} requestId={requestId} onClose={() => setDialog(null)} />}
      {dialog === "plan" && <PlanDialog requestId={requestId} remaining={(s.quotedAmount ?? 0) - s.paid - s.due} onClose={() => setDialog(null)} />}
      {typeof dialog === "object" && dialog && "pay" in dialog && <PayDialog id={dialog.pay} onClose={() => setDialog(null)} />}
    </div>
  );
}

function useDone(onClose: () => void, message: string) {
  const router = useRouter();
  const toast = useToast();
  return () => {
    toast("success", message);
    onClose();
    router.refresh();
  };
}

function RecordDialog({ requestType, requestId, onClose }: { requestType: PayableType; requestId: string; onClose: () => void }) {
  const [v, setV] = useState({ amount: "", status: "PAID", method: "MOMO", dueDate: "", paidAt: todayKigali(), reference: "" });
  const form = useActionForm<unknown>();
  const done = useDone(onClose, "Payment recorded.");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Record a payment"
      footer={
        <Button
          disabled={form.pending}
          onClick={async () => {
            const r = await form.run({
              schema: recordPaymentSchema,
              input: { requestType, requestId, amount: v.amount, status: v.status, method: v.status === "PAID" ? v.method : null, dueDate: v.status === "DUE" ? v.dueDate : "", paidAt: v.status === "PAID" ? v.paidAt : "", reference: v.reference },
              action: recordPayment,
            });
            if (r) done();
          }}
        >
          {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Amount (RWF)" error={form.errors.amount}>
          <Input placeholder="150,000" inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
            <option value="PAID">Paid</option>
            <option value="DUE">Due (to be paid)</option>
          </Select>
        </Field>
        {v.status === "PAID" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Method" error={form.errors.method}>
              <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Paid on">
              <Input type="date" value={v.paidAt} onChange={(e) => setV({ ...v, paidAt: e.target.value })} />
            </Field>
          </div>
        ) : (
          <Field label="Due date" error={form.errors.dueDate}>
            <Input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
          </Field>
        )}
        <Field label="Reference" optional>
          <Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} placeholder="MoMo or bank reference" />
        </Field>
        <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : form.formError?.fieldErrors?.amount ? form.formError.message : null} />
      </div>
    </Dialog>
  );
}

function PlanDialog({ requestId, remaining, onClose }: { requestId: string; remaining: number; onClose: () => void }) {
  const [rows, setRows] = useState([
    { amount: "", dueDate: "" },
    { amount: "", dueDate: "" },
    { amount: "", dueDate: "" },
  ]);
  const form = useActionForm<unknown>();
  const done = useDone(onClose, "Installment plan created.");
  const total = rows.reduce((a, r) => a + (Number(r.amount.replace(/[,\s]/g, "")) || 0), 0);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Installment plan"
      footer={
        <Button
          disabled={form.pending}
          data-testid="plan-save"
          onClick={async () => {
            const r = await form.run({ schema: createInstallmentPlanSchema, input: { serviceRequestId: requestId, installments: rows }, action: createInstallmentPlan });
            if (r) done();
          }}
        >
          {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Create plan
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">The installments must add up to {formatRwf(Math.max(remaining, 0))} (the quoted amount minus payments already planned or paid).</p>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label={`Amount ${i + 1}`}>
              <Input placeholder="150,000" inputMode="numeric" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={r.dueDate} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
            </Field>
            <Button variant="ghost" aria-label="Remove" disabled={rows.length <= 2} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={() => setRows([...rows, { amount: "", dueDate: "" }])} disabled={rows.length >= 24}>
            <Plus className="h-4 w-4" /> Add
          </Button>
          <p className={total === remaining ? "text-sm font-semibold text-success" : "text-sm font-semibold text-warning"}>Total {formatRwf(total)}</p>
        </div>
        <FormError message={form.errors.installments?.[0] ?? (form.formError && !form.formError.fieldErrors ? form.formError.message : null)} />
      </div>
    </Dialog>
  );
}

export function PayDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [v, setV] = useState({ method: "MOMO", reference: "", paidAt: todayKigali() });
  const form = useActionForm<unknown>();
  const done = useDone(onClose, "Marked as paid.");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Mark as paid"
      footer={
        <Button
          disabled={form.pending}
          onClick={async () => {
            const r = await form.run({ schema: markPaymentPaidSchema, input: { id, ...v }, action: markPaymentPaid });
            if (r) done();
          }}
        >
          {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm payment
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Method">
          <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" optional>
          <Input placeholder="e.g. MoMo 0788123456 or bank ref." value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} />
        </Field>
        <Field label="Paid on">
          <Input type="date" value={v.paidAt} onChange={(e) => setV({ ...v, paidAt: e.target.value })} />
        </Field>
        <FormError message={form.formError?.message} />
      </div>
    </Dialog>
  );
}

