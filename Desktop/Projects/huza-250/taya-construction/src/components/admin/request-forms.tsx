"use client";

// Editing the details of a request (staff). Status, handler and vendor have their own controls.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { UploadField } from "@/components/ui/upload";
import { useActionForm } from "@/lib/forms";
import { updateEquipmentRequest } from "@/server/modules/operations/equipment-request/equipment-request.actions";
import { updateEquipmentRequestSchema } from "@/server/modules/operations/equipment-request/equipment-request.schema";
import { updateSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.actions";
import { updateSupplyOrderSchema } from "@/server/modules/operations/supply-order/supply-order.schema";
import { createDeliveryReportUploadTicket, updateServiceRequest } from "@/server/modules/operations/service-request/service-request.actions";
import { updateServiceRequestSchema } from "@/server/modules/operations/service-request/service-request.schema";
import { publishJob, unpublishJob, updateWorkforceRequest } from "@/server/modules/operations/workforce-request/workforce-request.actions";
import { updateWorkforceRequestSchema } from "@/server/modules/operations/workforce-request/workforce-request.schema";
import { EntityPicker } from "./actions";

type Kind = "equipment" | "supply" | "service" | "workforce";

function useSave(kind: Kind) {
  const router = useRouter();
  const toast = useToast();
  const form = useActionForm<unknown>();
  const schema = { equipment: updateEquipmentRequestSchema, supply: updateSupplyOrderSchema, service: updateServiceRequestSchema, workforce: updateWorkforceRequestSchema }[kind];
  const action = { equipment: updateEquipmentRequest, supply: updateSupplyOrder, service: updateServiceRequest, workforce: updateWorkforceRequest }[kind];
  const save = async (input: Record<string, unknown>) => {
    const r = await form.run({ schema, input, action });
    if (r) {
      toast("success", "Saved.");
      router.refresh();
    }
  };
  return { form, save };
}

function SaveBar({ pending, error }: { pending: boolean; error?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <FormError message={error} />
      <Button type="submit" disabled={pending} className="ml-auto">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
      </Button>
    </div>
  );
}

export function EquipmentRequestForm({ r, canEdit }: { r: { id: string; details: string; siteLocation: string; startDate: string | null; endDate: string | null; quotedAmount: number | null; notes: string | null; type: string; equipment: { id: string; name: string } | null }; canEdit: boolean }) {
  const [v, setV] = useState({ details: r.details, siteLocation: r.siteLocation, startDate: r.startDate ?? "", endDate: r.endDate ?? "", quotedAmount: r.quotedAmount?.toString() ?? "", notes: r.notes ?? "" });
  const [equipment, setEquipment] = useState(r.equipment);
  const { form, save } = useSave("equipment");
  const e = form.errors;
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        save({ id: r.id, ...v, ...(equipment?.id !== r.equipment?.id ? { equipmentId: equipment?.id ?? null } : {}) });
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Equipment">
          <p className="mb-2 text-sm">{equipment ? <strong>{equipment.name}</strong> : <span className="text-muted">Sourcing request (no item)</span>}</p>
          {canEdit && <EntityPicker<{ id: string; name: string; location: string }> endpoint="/api/v1/catalog/equipment" label="Link equipment" placeholder="Link or change the equipment…" labelOf={(x) => x.name} detailOf={(x) => x.location} onPick={(x) => setEquipment({ id: x.id, name: x.name })} />}
        </Field>
        <Field label="Details" error={e.details}>
          <Textarea placeholder="e.g. Excavator for foundation works, 5 days with operator" value={v.details} onChange={(x) => setV({ ...v, details: x.target.value })} />
        </Field>
        <Field label="Site location" error={e.siteLocation}>
          <Input placeholder="Kicukiro, Kigali" value={v.siteLocation} onChange={(x) => setV({ ...v, siteLocation: x.target.value })} />
        </Field>
        {r.type === "RENT" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" error={e.startDate}>
              <Input type="date" value={v.startDate} onChange={(x) => setV({ ...v, startDate: x.target.value })} />
            </Field>
            <Field label="End" error={e.endDate}>
              <Input type="date" value={v.endDate} onChange={(x) => setV({ ...v, endDate: x.target.value })} />
            </Field>
          </div>
        )}
        <Field label="Quoted amount (RWF)" error={e.quotedAmount}>
          <Input placeholder="150,000" inputMode="numeric" value={v.quotedAmount} onChange={(x) => setV({ ...v, quotedAmount: x.target.value })} data-testid="quoted-amount" />
        </Field>
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => setV({ ...v, notes: x.target.value })} />
        </Field>
      </fieldset>
      {canEdit && <SaveBar pending={form.pending} error={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />}
    </form>
  );
}

export function SupplyOrderForm({ r, canEdit }: { r: { id: string; items: string; deliveryLocation: string; deliveryDate: string | null; quotedAmount: number | null; notes: string | null }; canEdit: boolean }) {
  const [v, setV] = useState({ items: r.items, deliveryLocation: r.deliveryLocation, deliveryDate: r.deliveryDate ?? "", quotedAmount: r.quotedAmount?.toString() ?? "", notes: r.notes ?? "" });
  const { form, save } = useSave("supply");
  const e = form.errors;
  return (
    <form className="space-y-4" onSubmit={(ev) => (ev.preventDefault(), save({ id: r.id, ...v }))}>
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Items" error={e.items}>
          <Textarea placeholder="e.g. 50 bags of cement, 2 trips of sand" value={v.items} onChange={(x) => setV({ ...v, items: x.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Delivery location" error={e.deliveryLocation}>
            <Input placeholder="Kicukiro, Kigali" value={v.deliveryLocation} onChange={(x) => setV({ ...v, deliveryLocation: x.target.value })} />
          </Field>
          <Field label="Delivery date">
            <Input type="date" value={v.deliveryDate} onChange={(x) => setV({ ...v, deliveryDate: x.target.value })} />
          </Field>
        </div>
        <Field label="Quoted amount (RWF)" error={e.quotedAmount}>
          <Input placeholder="150,000" inputMode="numeric" value={v.quotedAmount} onChange={(x) => setV({ ...v, quotedAmount: x.target.value })} />
        </Field>
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => setV({ ...v, notes: x.target.value })} />
        </Field>
      </fieldset>
      {canEdit && <SaveBar pending={form.pending} error={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />}
    </form>
  );
}

export function ServiceRequestForm({
  r,
  canEdit,
  uploadsEnabled,
}: {
  r: { id: string; details: string; siteLocation: string; preferredDate: string | null; quotedAmount: number | null; paymentPlan: string; notes: string | null; deliveryReport: { text: string | null; fileLink: string | null; hasFile: boolean } };
  canEdit: boolean;
  uploadsEnabled: boolean;
}) {
  const [v, setV] = useState({ details: r.details, siteLocation: r.siteLocation, preferredDate: r.preferredDate ?? "", quotedAmount: r.quotedAmount?.toString() ?? "", notes: r.notes ?? "", report: r.deliveryReport.text ?? "" });
  const [installments, setInstallments] = useState(r.paymentPlan === "INSTALLMENT");
  const [reportFile, setReportFile] = useState<string[]>([]);
  const { form, save } = useSave("service");
  const e = form.errors;
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const reportChanged = reportFile[0] || v.report !== (r.deliveryReport.text ?? "");
        save({
          id: r.id,
          details: v.details,
          siteLocation: v.siteLocation,
          preferredDate: v.preferredDate,
          quotedAmount: v.quotedAmount,
          notes: v.notes,
          paymentPlan: installments ? "INSTALLMENT" : "FULL",
          ...(reportChanged ? { deliveryReport: reportFile[0] ?? v.report } : {}),
        });
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Details" error={e.details}>
          <Textarea placeholder="e.g. Structural inspection of a 3-storey building in Remera" value={v.details} onChange={(x) => setV({ ...v, details: x.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site location" error={e.siteLocation}>
            <Input placeholder="Kicukiro, Kigali" value={v.siteLocation} onChange={(x) => setV({ ...v, siteLocation: x.target.value })} />
          </Field>
          <Field label="Preferred date">
            <Input type="date" value={v.preferredDate} onChange={(x) => setV({ ...v, preferredDate: x.target.value })} />
          </Field>
        </div>
        <Field label="Quoted amount (RWF)" error={e.quotedAmount}>
          <Input placeholder="150,000" inputMode="numeric" value={v.quotedAmount} onChange={(x) => setV({ ...v, quotedAmount: x.target.value })} data-testid="quoted-amount" />
        </Field>
        <Checkbox label="Payment plan: installments (pay later)" checked={installments} onChange={(x) => setInstallments(x.target.checked)} />
        <Field label="Delivery report" optional hint="Write a short report, or upload the report file.">
          <Textarea placeholder="Kicukiro, Kigali" value={v.report} onChange={(x) => setV({ ...v, report: x.target.value })} className="min-h-16" />
        </Field>
        {r.deliveryReport.hasFile && (
          <p className="text-sm">
            Report file:{" "}
            {r.deliveryReport.fileLink ? (
              <a href={r.deliveryReport.fileLink} className="font-semibold underline" target="_blank" rel="noopener noreferrer">
                Download
              </a>
            ) : (
              "stored (storage not configured here)"
            )}
          </p>
        )}
        {canEdit && <UploadField enabled={uploadsEnabled} value={reportFile} onChange={setReportFile} getTicket={createDeliveryReportUploadTicket} accept="application/pdf,image/jpeg,image/png" multiple={false} label="Add report file" mode="file" maxMb={10} library={{ folder: "delivery-reports" }} />}
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => setV({ ...v, notes: x.target.value })} />
        </Field>
      </fieldset>
      {canEdit && <SaveBar pending={form.pending} error={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />}
    </form>
  );
}

export function WorkforceRequestForm({ r, canEdit }: { r: { id: string; role: string; quantity: number; duration: string; siteLocation: string; startDate: string | null; details: string | null; notes: string | null }; canEdit: boolean }) {
  const [v, setV] = useState({ role: r.role, quantity: String(r.quantity), duration: r.duration, siteLocation: r.siteLocation, startDate: r.startDate ?? "", details: r.details ?? "", notes: r.notes ?? "" });
  const { form, save } = useSave("workforce");
  const e = form.errors;
  return (
    <form className="space-y-4" onSubmit={(ev) => (ev.preventDefault(), save({ id: r.id, ...v }))}>
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role" error={e.role}>
            <Input placeholder="e.g. Mason" value={v.role} onChange={(x) => setV({ ...v, role: x.target.value })} />
          </Field>
          <Field label="Number of workers" error={e.quantity}>
            <Input placeholder="e.g. 4" type="number" min={1} value={v.quantity} onChange={(x) => setV({ ...v, quantity: x.target.value })} />
          </Field>
          <Field label="Duration" error={e.duration}>
            <Input placeholder="e.g. 3 weeks" value={v.duration} onChange={(x) => setV({ ...v, duration: x.target.value })} />
          </Field>
          <Field label="Start date">
            <Input type="date" value={v.startDate} onChange={(x) => setV({ ...v, startDate: x.target.value })} />
          </Field>
        </div>
        <Field label="Site" error={e.siteLocation}>
          <Input placeholder="Kicukiro, Kigali" value={v.siteLocation} onChange={(x) => setV({ ...v, siteLocation: x.target.value })} />
        </Field>
        <Field label="Client's notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.details} onChange={(x) => setV({ ...v, details: x.target.value })} />
        </Field>
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => setV({ ...v, notes: x.target.value })} />
        </Field>
      </fieldset>
      {canEdit && <SaveBar pending={form.pending} error={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />}
    </form>
  );
}

// The "Job post" panel: description, deadline and the Publish toggle (OPS-R11).
export function JobPostPanel({ r, canPublish }: { r: { id: string; jobDescription: string | null; deadline: string | null; isPublished: boolean; isOpen: boolean; number: number }; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [desc, setDesc] = useState(r.jobDescription ?? "");
  const [deadline, setDeadline] = useState(r.deadline ?? "");
  const form = useActionForm<unknown>();
  async function publish() {
    const res = await form.run({ input: { id: r.id, jobDescription: desc, deadline }, action: publishJob });
    if (res) {
      toast("success", "Job published.");
      router.refresh();
    }
  }
  async function unpublish() {
    const res = await form.run({ input: { id: r.id }, action: unpublishJob });
    if (res) {
      toast("success", "Job unpublished.");
      router.refresh();
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {r.isPublished ? (r.isOpen ? <span className="font-semibold text-success">Published and open</span> : <span className="font-semibold text-warning">Published, but not open (filled, closed or past deadline)</span>) : <span className="text-muted">Not published</span>}
        {r.isPublished && r.isOpen && (
          <a href={`/jobs/${r.number}`} target="_blank" className="ml-2 underline" rel="noreferrer">
            View post
          </a>
        )}
      </p>
      <Field label="Job description" error={form.errors.jobDescription}>
        <Textarea placeholder="Duties, working hours, pay and what to bring" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!canPublish} className="min-h-32" data-testid="job-description" />
      </Field>
      <Field label="Applications close" optional error={form.errors.deadline}>
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!canPublish} />
      </Field>
      <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      {canPublish && (
        <div className="flex gap-2">
          <Button onClick={publish} disabled={form.pending} data-testid="publish-job">
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} {r.isPublished ? "Save & keep published" : "Publish job"}
          </Button>
          {r.isPublished && (
            <Button variant="outline" onClick={unpublish} disabled={form.pending}>
              Unpublish
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

