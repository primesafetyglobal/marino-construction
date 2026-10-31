"use client";

// "New request" for phone, WhatsApp and walk-in clients (Design §6):
// type → client (autocomplete or create) → request fields → source.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/lib/forms";
import { createEquipmentRequest } from "@/server/modules/operations/equipment-request/equipment-request.actions";
import { createEquipmentRequestSchema } from "@/server/modules/operations/equipment-request/equipment-request.schema";
import { createSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.actions";
import { createSupplyOrderSchema } from "@/server/modules/operations/supply-order/supply-order.schema";
import { createServiceRequest } from "@/server/modules/operations/service-request/service-request.actions";
import { createServiceRequestSchema } from "@/server/modules/operations/service-request/service-request.schema";
import { createWorkforceRequest } from "@/server/modules/operations/workforce-request/workforce-request.actions";
import { createWorkforceRequestSchema } from "@/server/modules/operations/workforce-request/workforce-request.schema";
import { EntityPicker } from "./actions";
import { ClientFormDialog } from "./party-forms";

type Kind = "equipment" | "supply" | "service" | "workforce";
type Ref = { id: string; name: string };
const PATH = { equipment: "/admin/equipment-requests", supply: "/admin/supply-orders", service: "/admin/service-requests", workforce: "/admin/workforce-requests" };

export function NewRequestForm() {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("equipment");
  const [client, setClient] = useState<Ref | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [item, setItem] = useState<Ref | null>(null);
  const [source, setSource] = useState("PHONE");
  const [v, setV] = useState({ type: "RENT", details: "", siteLocation: "", startDate: "", endDate: "", items: "", deliveryLocation: "", deliveryDate: "", preferredDate: "", installments: false, role: "", quantity: "1", duration: "", quotedAmount: "", notes: "" });
  const form = useActionForm<{ id: string; code: string }>();
  const e = form.errors;
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));

  async function save() {
    const base = { clientId: client?.id ?? "", source, notes: v.notes };
    const run = {
      equipment: () => form.run({ schema: createEquipmentRequestSchema, action: createEquipmentRequest, input: { ...base, equipmentId: item?.id ?? null, type: v.type, details: v.details, siteLocation: v.siteLocation, startDate: v.startDate, endDate: v.endDate, quotedAmount: v.quotedAmount } }),
      supply: () => form.run({ schema: createSupplyOrderSchema, action: createSupplyOrder, input: { ...base, productId: item?.id ?? null, items: v.items, deliveryLocation: v.deliveryLocation, deliveryDate: v.deliveryDate, quotedAmount: v.quotedAmount } }),
      service: () => form.run({ schema: createServiceRequestSchema, action: createServiceRequest, input: { ...base, serviceId: item?.id ?? "", details: v.details, siteLocation: v.siteLocation, preferredDate: v.preferredDate, paymentPlan: v.installments ? "INSTALLMENT" : "FULL", quotedAmount: v.quotedAmount } }),
      workforce: () => form.run({ schema: createWorkforceRequestSchema, action: createWorkforceRequest, input: { ...base, role: v.role, quantity: v.quantity, duration: v.duration, siteLocation: v.siteLocation, startDate: v.startDate, details: v.details } }),
    }[kind];
    const r = await run();
    if (!r) return;
    toast("success", `Request ${r.code} created.`);
    router.push(`${PATH[kind]}/${r.id}`);
  }

  const itemPicker = {
    equipment: { endpoint: "/api/v1/catalog/equipment" as const, label: "Equipment (optional)" },
    supply: { endpoint: "/api/v1/catalog/product" as const, label: "Product (optional)" },
    service: { endpoint: "/api/v1/catalog/service" as const, label: "Service" },
    workforce: null,
  }[kind];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-semibold">1. Type</h2>
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setItem(null);
          }}
          options={[
            { value: "equipment", label: "Equipment" },
            { value: "supply", label: "Materials" },
            { value: "service", label: "Service" },
            { value: "workforce", label: "Workforce" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">2. Client</h2>
        {client ? (
          <div className="flex items-center justify-between rounded-xl bg-mist px-4 py-3">
            <span className="font-semibold">{client.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setClient(null)} aria-label="Change client">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <div className="min-w-64 flex-1">
              <EntityPicker<{ id: string; name: string; companyName: string | null; phone: string | null; email: string | null }>
                endpoint="/api/v1/parties/client"
                label="Find a client"
                placeholder="Search by name, phone or email…"
                labelOf={(c) => c.companyName ?? c.name}
                detailOf={(c) => [c.phone, c.email].filter(Boolean).join(" · ")}
                onPick={(c) => setClient({ id: c.id, name: c.companyName ?? c.name })}
                testId="client-picker"
              />
            </div>
            <Button variant="outline" onClick={() => setNewClient(true)}>
              New client
            </Button>
          </div>
        )}
        {e.clientId && <p className="text-xs text-danger">{e.clientId[0]}</p>}
        {newClient && <ClientFormDialog open onClose={() => setNewClient(false)} onCreated={(c) => setClient({ id: c.id, name: c.name })} />}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">3. Request</h2>
        {itemPicker && (
          <Field label={itemPicker.label} error={e.serviceId ?? e.equipmentId ?? e.productId}>
            {item ? (
              <div className="flex items-center justify-between rounded-xl bg-mist px-4 py-2.5 text-sm">
                <span className="font-medium">{item.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setItem(null)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <EntityPicker<{ id: string; name: string }> endpoint={itemPicker.endpoint} label={itemPicker.label} labelOf={(x) => x.name} onPick={(x) => setItem({ id: x.id, name: x.name })} />
            )}
          </Field>
        )}
        {kind === "equipment" && (
          <>
            <Segmented value={v.type} onChange={(t) => set({ type: t })} options={[{ value: "RENT", label: "Rent" }, { value: "BUY", label: "Buy" }]} />
            {v.type === "RENT" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" error={e.startDate}>
                  <Input type="date" value={v.startDate} onChange={(x) => set({ startDate: x.target.value })} />
                </Field>
                <Field label="End" error={e.endDate}>
                  <Input type="date" value={v.endDate} onChange={(x) => set({ endDate: x.target.value })} />
                </Field>
              </div>
            )}
          </>
        )}
        {kind === "supply" && (
          <>
            <Field label="Items and quantities" error={e.items}>
              <Textarea placeholder="e.g. 50 bags of cement, 2 trips of sand" value={v.items} onChange={(x) => set({ items: x.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Delivery location" error={e.deliveryLocation}>
                <Input placeholder="Kicukiro, Kigali" value={v.deliveryLocation} onChange={(x) => set({ deliveryLocation: x.target.value })} />
              </Field>
              <Field label="Delivery date">
                <Input type="date" value={v.deliveryDate} onChange={(x) => set({ deliveryDate: x.target.value })} />
              </Field>
            </div>
          </>
        )}
        {kind === "workforce" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Role" error={e.role}>
              <Input placeholder="e.g. Mason" value={v.role} onChange={(x) => set({ role: x.target.value })} />
            </Field>
            <Field label="Workers" error={e.quantity}>
              <Input placeholder="e.g. 4" type="number" min={1} value={v.quantity} onChange={(x) => set({ quantity: x.target.value })} />
            </Field>
            <Field label="Duration" error={e.duration}>
              <Input placeholder="e.g. 3 weeks" value={v.duration} onChange={(x) => set({ duration: x.target.value })} />
            </Field>
          </div>
        )}
        {kind !== "supply" && (
          <Field label={kind === "workforce" ? "Site" : "Site location"} error={e.siteLocation}>
            <Input placeholder="Kicukiro, Kigali" value={v.siteLocation} onChange={(x) => set({ siteLocation: x.target.value })} />
          </Field>
        )}
        {kind === "service" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred date">
              <Input type="date" value={v.preferredDate} onChange={(x) => set({ preferredDate: x.target.value })} />
            </Field>
            <div className="pt-7">
              <Checkbox label="Pay in installments" checked={v.installments} onChange={(x) => set({ installments: x.target.checked })} />
            </div>
          </div>
        )}
        {kind === "workforce" && (
          <Field label="Start date">
            <Input type="date" value={v.startDate} onChange={(x) => set({ startDate: x.target.value })} />
          </Field>
        )}
        {kind !== "supply" && (
          <Field label={kind === "workforce" ? "Client's notes" : "Details"} error={e.details} optional={kind === "workforce"}>
            <Textarea placeholder="e.g. Excavator for foundation works, 5 days with operator" value={v.details} onChange={(x) => set({ details: x.target.value })} />
          </Field>
        )}
        {kind !== "workforce" && (
          <Field label="Quoted amount (RWF)" optional error={e.quotedAmount}>
            <Input placeholder="150,000" inputMode="numeric" value={v.quotedAmount} onChange={(x) => set({ quotedAmount: x.target.value })} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source">
            <Select value={source} onChange={(x) => setSource(x.target.value)}>
              <option value="PHONE">Phone</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WALK_IN">Walk-in</option>
            </Select>
          </Field>
        </div>
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => set({ notes: x.target.value })} />
        </Field>
      </section>

      <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      <Button size="lg" onClick={save} disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Create request
      </Button>
    </div>
  );
}
