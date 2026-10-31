"use client";

// "Rent out / sell your equipment" and "Partner with us" (Design §6).
// "Worked with Marino before?" Yes: phone or email only. No: vendor details.

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Turnstile } from "@/components/ui/turnstile";
import { UploadField } from "@/components/ui/upload";
import { useActionForm } from "@/lib/forms";
import { createEquipmentUploadTicket, submitEquipment } from "@/server/modules/catalog/equipment/equipment.actions";
import { submitEquipmentSchema } from "@/server/modules/catalog/equipment/equipment.schema";
import { submitVendor } from "@/server/modules/parties/vendor/vendor.actions";
import { submitVendorSchema } from "@/server/modules/parties/vendor/vendor.schema";
import { VENDOR_TYPE_LABEL, VENDOR_TYPES } from "@/server/modules/parties/parties.fields";
import { ContactStep, emptyContact, Honeypot, type ContactValues } from "./contact-step";

function Thanks() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center animate-fade-up">
      <CheckCircle2 className="h-14 w-14 text-success" />
      <p className="text-xl font-semibold" data-testid="vendor-success">
        Thank you.
      </p>
      <p className="max-w-md text-muted">Our team will review and contact you.</p>
    </div>
  );
}

function Consent({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string[] }) {
  return (
    <Checkbox
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      label={
        <span>
          I agree that Marino stores my details to review my offer and contact me.
          {error && <span className="block text-xs font-medium text-danger">{error[0]}</span>}
        </span>
      }
    />
  );
}

export function ListEquipmentForm({ categories, uploadsEnabled }: { categories: { id: string; name: string }[]; uploadsEnabled: boolean }) {
  const [v, setV] = useState({ categoryId: "", name: "", description: "", location: "", forRent: true, rentPrice: "", rentUnit: "DAY", forSale: false, salePrice: "" });
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const form = useActionForm<{ received: true }>();
  const e = form.errors;
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  if (done) return <Thanks />;
  return (
    <form
      className="relative space-y-6"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const input = {
          categoryId: v.categoryId,
          name: v.name,
          description: v.description,
          location: v.location,
          images,
          specs: specs.filter((s) => s.label || s.value),
          forRent: v.forRent,
          rentPrice: v.forRent ? v.rentPrice : "",
          rentUnit: v.forRent && v.rentPrice ? v.rentUnit : null,
          forSale: v.forSale,
          salePrice: v.forSale ? v.salePrice : "",
          returning: contact.returning,
          phone: contact.phone,
          email: contact.email,
          contactName: contact.returning ? "" : contact.name,
          entityType: contact.entityType,
          companyName: contact.entityType === "COMPANY" ? contact.companyName : "",
          tin: contact.entityType === "COMPANY" ? contact.tin : "",
          district: contact.district,
          consent: consent as true,
          fax,
          turnstileToken: token,
        };
        const result = await form.run({ schema: submitEquipmentSchema, input, action: submitEquipment });
        if (result) setDone(true);
      }}
    >
      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Your equipment</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" name="categoryId" error={e.categoryId}>
            <Select name="categoryId" value={v.categoryId} onChange={(x) => set({ categoryId: x.target.value })} invalid={!!e.categoryId}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" name="name" error={e.name}>
            <Input name="name" placeholder="e.g. CAT 320 Excavator" value={v.name} onChange={(x) => set({ name: x.target.value })} invalid={!!e.name} />
          </Field>
        </div>
        <Field label="Description" name="description" error={e.description}>
          <Textarea name="description" placeholder="Condition, year, hours, operator available…" value={v.description} onChange={(x) => set({ description: x.target.value })} invalid={!!e.description} />
        </Field>
        <Field label="Location (district)" name="location" error={e.location}>
          <Input placeholder="Kicukiro, Kigali" name="location" value={v.location} onChange={(x) => set({ location: x.target.value })} invalid={!!e.location} />
        </Field>
        <Field label="Photos" optional error={e.images}>
          <UploadField enabled={uploadsEnabled} value={images} onChange={setImages} getTicket={createEquipmentUploadTicket} maxMb={8} />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">Specifications <span className="font-normal text-muted">(optional)</span></p>
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="Label" placeholder="e.g. Capacity" value={s.label} onChange={(x) => setSpecs(specs.map((y, j) => (j === i ? { ...y, label: x.target.value } : y)))} />
              <Input aria-label="Value" placeholder="e.g. 20 t" value={s.value} onChange={(x) => setSpecs(specs.map((y, j) => (j === i ? { ...y, value: x.target.value } : y)))} />
              <Button variant="ghost" aria-label="Remove row" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {specs.length < 20 && (
            <Button variant="outline" size="sm" onClick={() => setSpecs([...specs, { label: "", value: "" }])}>
              <Plus className="h-4 w-4" /> Add a row
            </Button>
          )}
          {e.specs && <p className="text-xs text-danger">{e.specs[0]}</p>}
        </div>
        <div className="grid gap-4 rounded-2xl bg-mist p-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Checkbox label="Available for rent" checked={v.forRent} onChange={(x) => set({ forRent: x.target.checked })} />
            {v.forRent && (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input aria-label="Rent price (RWF)" placeholder="Rent price (RWF)" inputMode="numeric" value={v.rentPrice} onChange={(x) => set({ rentPrice: x.target.value })} />
                <Select aria-label="Per" value={v.rentUnit} onChange={(x) => set({ rentUnit: x.target.value })} className="w-32">
                  <option value="DAY">/ day</option>
                  <option value="WEEK">/ week</option>
                  <option value="MONTH">/ month</option>
                  <option value="PROJECT">/ project</option>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Checkbox label="For sale" checked={v.forSale} onChange={(x) => set({ forSale: x.target.checked })} />
            {v.forSale && <Input aria-label="Sale price (RWF)" placeholder="Sale price (RWF)" inputMode="numeric" value={v.salePrice} onChange={(x) => set({ salePrice: x.target.value })} />}
          </div>
          {(e.forRent || e.rentUnit || e.rentPrice || e.salePrice) && <p className="text-xs text-danger sm:col-span-2">{(e.forRent ?? e.rentUnit ?? e.rentPrice ?? e.salePrice)![0]}</p>}
        </div>
      </fieldset>
      <fieldset className="space-y-4 border-t border-line/60 pt-6">
        <legend className="mb-2 text-lg font-semibold">About you</legend>
        <ContactStep value={contact} onChange={setContact} errors={e} who="vendor" question="Have you worked with Marino before?" />
      </fieldset>
      <Consent checked={consent} onChange={setConsent} error={e.consent} />
      <Honeypot value={fax} onChange={setFax} />
      <Turnstile onToken={setToken} />
      <FormError message={form.formError && (form.formError.code !== "VALIDATION" || !form.formError.fieldErrors) ? form.formError.message : null} />
      <Button type="submit" size="lg" disabled={form.pending} data-testid="vendor-submit">
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Submit equipment
      </Button>
    </form>
  );
}

export function PartnerForm() {
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [type, setType] = useState("SUPPLIER");
  const [offerings, setOfferings] = useState("");
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const form = useActionForm<{ received: true }>();
  const e = form.errors;

  if (done) return <Thanks />;
  return (
    <form
      className="relative space-y-6"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const input = {
          returning: contact.returning,
          phone: contact.phone,
          email: contact.email,
          name: contact.returning ? "" : contact.name,
          type,
          entityType: contact.entityType,
          companyName: contact.entityType === "COMPANY" ? contact.companyName : "",
          tin: contact.entityType === "COMPANY" ? contact.tin : "",
          district: contact.district,
          offerings: contact.returning ? "" : offerings,
          consent: consent as true,
          fax,
          turnstileToken: token,
        };
        const result = await form.run({ schema: submitVendorSchema, input, action: submitVendor });
        if (result) setDone(true);
      }}
    >
      <ContactStep value={contact} onChange={setContact} errors={e} who="vendor" question="Have you worked with Marino before?" />
      {!contact.returning && (
        <div className="space-y-4 animate-fade-up">
          <Field label="You are a" name="type">
            <Select name="type" value={type} onChange={(x) => setType(x.target.value)}>
              {VENDOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VENDOR_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What do you offer?" name="offerings" error={e.offerings}>
            <Textarea name="offerings" placeholder="Products, services, areas you cover…" value={offerings} onChange={(x) => setOfferings(x.target.value)} invalid={!!e.offerings} />
          </Field>
        </div>
      )}
      <Consent checked={consent} onChange={setConsent} error={e.consent} />
      <Honeypot value={fax} onChange={setFax} />
      <Turnstile onToken={setToken} />
      <FormError message={form.formError && (form.formError.code !== "VALIDATION" || !form.formError.fieldErrors) ? form.formError.message : null} />
      <Button type="submit" size="lg" disabled={form.pending} data-testid="vendor-submit">
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Send
      </Button>
    </form>
  );
}
