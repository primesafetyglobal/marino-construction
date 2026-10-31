"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { UploadField } from "@/components/ui/upload";
import { useActionForm } from "@/lib/forms";
import { createClient, updateClient } from "@/server/modules/parties/client/client.actions";
import { createClientSchema, updateClientSchema } from "@/server/modules/parties/client/client.schema";
import { createPartiesUploadTicket, createVendor, updateVendor } from "@/server/modules/parties/vendor/vendor.actions";
import { createVendorSchema, updateVendorSchema } from "@/server/modules/parties/vendor/vendor.schema";
import { updateApplicant } from "@/server/modules/parties/applicant/applicant.actions";
import { updateApplicantSchema } from "@/server/modules/parties/applicant/applicant.schema";
import { VENDOR_TYPE_LABEL, VENDOR_TYPES } from "@/server/modules/parties/parties.fields";
import { RWANDA_DISTRICTS } from "@/components/public/contact-step";

type ClientValues = { name: string; phone: string; email: string; entityType: "INDIVIDUAL" | "COMPANY"; companyName: string; tin: string; district: string; notes: string };

export function ClientFormDialog({ open, onClose, client, onCreated }: { open: boolean; onClose: () => void; client?: Partial<Record<keyof ClientValues, string | null>> & { id: string }; onCreated?: (c: { id: string; name: string }) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<ClientValues>({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    entityType: (client?.entityType as ClientValues["entityType"]) ?? "INDIVIDUAL",
    companyName: client?.companyName ?? "",
    tin: client?.tin ?? "",
    district: client?.district ?? "",
    notes: client?.notes ?? "",
  });
  const form = useActionForm<{ id: string; name: string }>();
  const e = form.errors;
  const set = (p: Partial<ClientValues>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const r = client
      ? await form.run({ schema: updateClientSchema, input: { id: client.id, ...v }, action: updateClient })
      : await form.run({ schema: createClientSchema, input: v, action: createClient });
    if (!r) return;
    toast("success", client ? "Client updated." : "Client created.");
    onCreated?.(r);
    onClose();
    router.refresh();
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? "Edit client" : "New client"}
      footer={
        <Button onClick={save} disabled={form.pending} data-testid="client-save">
          {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name" error={e.name}>
          <Input placeholder="e.g. Jean Mugisha" value={v.name} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" error={e.phone}>
            <Input placeholder="+250 788 123 456" value={v.phone} onChange={(x) => set({ phone: x.target.value })} />
          </Field>
          <Field label="Email" error={e.email}>
            <Input placeholder="name@example.rw" value={v.email} onChange={(x) => set({ email: x.target.value })} />
          </Field>
        </div>
        <Segmented value={v.entityType} onChange={(t) => set({ entityType: t })} options={[{ value: "INDIVIDUAL", label: "Individual" }, { value: "COMPANY", label: "Company" }]} />
        {v.entityType === "COMPANY" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" error={e.companyName}>
              <Input placeholder="e.g. Ubaka Builders Ltd" value={v.companyName} onChange={(x) => set({ companyName: x.target.value })} />
            </Field>
            <Field label="TIN" error={e.tin} optional>
              <Input placeholder="9 digits, e.g. 102345678" value={v.tin} onChange={(x) => set({ tin: x.target.value })} />
            </Field>
          </div>
        )}
        <Field label="District" optional>
          <Select value={v.district} onChange={(x) => set({ district: x.target.value })}>
            <option value="">-</option>
            {RWANDA_DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Staff notes" optional>
          <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => set({ notes: x.target.value })} />
        </Field>
        <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
      </div>
    </Dialog>
  );
}

export function ClientFormButton({ client, label = "New client" }: { client?: Parameters<typeof ClientFormDialog>[0]["client"]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={client ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && <ClientFormDialog open onClose={() => setOpen(false)} client={client} />}
    </>
  );
}

type VendorValues = { name: string; phone: string; email: string; type: string; entityType: "INDIVIDUAL" | "COMPANY"; companyName: string; tin: string; district: string; offerings: string; website: string; notes: string };

export function VendorFormButton({ vendor, uploadsEnabled, label }: { vendor?: Partial<Record<keyof VendorValues | "logo", string | null>> & { id: string }; uploadsEnabled: boolean; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<VendorValues>({
    name: vendor?.name ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    type: vendor?.type ?? "SUPPLIER",
    entityType: (vendor?.entityType as VendorValues["entityType"]) ?? "INDIVIDUAL",
    companyName: vendor?.companyName ?? "",
    tin: vendor?.tin ?? "",
    district: vendor?.district ?? "",
    offerings: vendor?.offerings ?? "",
    website: vendor?.website ?? "",
    notes: vendor?.notes ?? "",
  });
  const [logo, setLogo] = useState<string[]>(vendor?.logo ? [vendor.logo] : []);
  const form = useActionForm<unknown>();
  const e = form.errors;
  const set = (p: Partial<VendorValues>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    const input = { ...v, logo: logo[0] ?? "" };
    const r = vendor ? await form.run({ schema: updateVendorSchema, input: { id: vendor.id, ...input }, action: updateVendor }) : await form.run({ schema: createVendorSchema, input, action: createVendor });
    if (!r) return;
    toast("success", vendor ? "Vendor updated." : "Vendor created.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant={vendor ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={vendor ? "Edit vendor" : "New vendor"}
        footer={
          <Button onClick={save} disabled={form.pending}>
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Contact person or business" error={e.name}>
            <Input placeholder="e.g. Ubaka Builders Ltd" value={v.name} onChange={(x) => set({ name: x.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" error={e.phone}>
              <Input placeholder="+250 788 123 456" value={v.phone} onChange={(x) => set({ phone: x.target.value })} />
            </Field>
            <Field label="Email" error={e.email}>
              <Input placeholder="name@example.rw" value={v.email} onChange={(x) => set({ email: x.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={v.type} onChange={(x) => set({ type: x.target.value })}>
                {VENDOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VENDOR_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="District" optional>
              <Select value={v.district} onChange={(x) => set({ district: x.target.value })}>
                <option value="">-</option>
                {RWANDA_DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Segmented value={v.entityType} onChange={(t) => set({ entityType: t })} options={[{ value: "INDIVIDUAL", label: "Individual" }, { value: "COMPANY", label: "Company" }]} />
          {v.entityType === "COMPANY" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name" error={e.companyName}>
                <Input placeholder="e.g. Ubaka Builders Ltd" value={v.companyName} onChange={(x) => set({ companyName: x.target.value })} />
              </Field>
              <Field label="TIN" error={e.tin} optional>
                <Input placeholder="9 digits, e.g. 102345678" value={v.tin} onChange={(x) => set({ tin: x.target.value })} />
              </Field>
            </div>
          )}
          <Field label="What they offer" error={e.offerings}>
            <Textarea placeholder="e.g. Excavators and tipper trucks for rent, with operators" value={v.offerings} onChange={(x) => set({ offerings: x.target.value })} />
          </Field>
          <Field label="Website / shop link" optional error={e.website} hint="Partner suppliers with a website show in “Featured shops”.">
            <Input value={v.website} onChange={(x) => set({ website: x.target.value })} placeholder="https://" />
          </Field>
          <Field label="Logo" optional hint="Shown on the About page partner row and on the vendor's Featured shops card on the home page." error={e.logo}>
            <UploadField enabled={uploadsEnabled} value={logo} onChange={setLogo} getTicket={(i) => createPartiesUploadTicket({ kind: "logo", ...i })} multiple={false} accept="image/jpeg,image/png,image/webp,image/svg+xml" label="Add logo" mode="image" maxMb={4} library={{ folder: "vendor-logos" }} />
          </Field>
          <Field label="Staff notes" optional>
            <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => set({ notes: x.target.value })} />
          </Field>
          <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
        </div>
      </Dialog>
    </>
  );
}

export function ApplicantFormButton({
  a,
  uploadsEnabled,
}: {
  a: { id: string; fullName: string; phone: string | null; email: string | null; dateOfBirth: string; gender: string | null; trade: string; experience: string; district: string | null; notes: string | null };
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ fullName: a.fullName, phone: a.phone ?? "", email: a.email ?? "", dateOfBirth: a.dateOfBirth, gender: a.gender ?? "", trade: a.trade, experience: a.experience, district: a.district ?? "", notes: a.notes ?? "" });
  const [cv, setCv] = useState<string[]>([]);
  const form = useActionForm<unknown>();
  const e = form.errors;
  async function save() {
    const r = await form.run({ schema: updateApplicantSchema, input: { id: a.id, ...v, gender: v.gender || null, ...(cv[0] ? { cvUrl: cv[0] } : {}) }, action: updateApplicant });
    if (!r) return;
    toast("success", "Profile updated.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit profile
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit applicant"
        footer={
          <Button onClick={save} disabled={form.pending}>
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" error={e.fullName}>
            <Input placeholder="e.g. Jean Mugisha" value={v.fullName} onChange={(x) => setV({ ...v, fullName: x.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone" error={e.phone}>
              <Input placeholder="+250 788 123 456" value={v.phone} onChange={(x) => setV({ ...v, phone: x.target.value })} />
            </Field>
            <Field label="Email" error={e.email}>
              <Input placeholder="name@example.rw" value={v.email} onChange={(x) => setV({ ...v, email: x.target.value })} />
            </Field>
            <Field label="Date of birth" error={e.dateOfBirth}>
              <Input type="date" value={v.dateOfBirth} onChange={(x) => setV({ ...v, dateOfBirth: x.target.value })} />
            </Field>
            <Field label="Gender">
              <Select value={v.gender} onChange={(x) => setV({ ...v, gender: x.target.value })}>
                <option value="">-</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field label="Trade" error={e.trade}>
              <Input placeholder="e.g. Mason" value={v.trade} onChange={(x) => setV({ ...v, trade: x.target.value })} />
            </Field>
            <Field label="District">
              <Input placeholder="Kicukiro, Kigali" value={v.district} onChange={(x) => setV({ ...v, district: x.target.value })} />
            </Field>
          </div>
          <Field label="Experience" error={e.experience}>
            <Textarea placeholder="e.g. 5 years on building sites" value={v.experience} onChange={(x) => setV({ ...v, experience: x.target.value })} />
          </Field>
          <Field label="Replace CV" optional>
            <UploadField enabled={uploadsEnabled} value={cv} onChange={setCv} getTicket={(i) => createPartiesUploadTicket({ kind: "cv", ...i })} accept="application/pdf" multiple={false} label="Add CV (PDF)" mode="file" maxMb={5} library={{ folder: "cvs" }} />
          </Field>
          <Field label="Staff notes" optional>
            <Textarea placeholder="Internal notes, never shown to the client" value={v.notes} onChange={(x) => setV({ ...v, notes: x.target.value })} />
          </Field>
          <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : null} />
        </div>
      </Dialog>
    </>
  );
}
