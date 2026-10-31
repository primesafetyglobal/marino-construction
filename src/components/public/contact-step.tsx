"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { Field, Input, Segmented, Select } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/forms";

export type ContactValues = {
  returning: boolean;
  phone: string;
  email: string;
  name: string;
  entityType: "INDIVIDUAL" | "COMPANY";
  companyName: string;
  tin: string;
  district: string;
};

export const emptyContact: ContactValues = {
  returning: false,
  phone: "",
  email: "",
  name: "",
  entityType: "INDIVIDUAL",
  companyName: "",
  tin: "",
  district: "",
};

export const RWANDA_DISTRICTS = [
  "Gasabo", "Kicukiro", "Nyarugenge", "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo", "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe",
  "Nyanza", "Nyaruguru", "Ruhango", "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
];

// "Have you used Marino before?" (Design §7, Returning contact step).
// Yes: phone or email only, confirmed by the contact check (which answers only
// { known }). No (or not found): the new-contact fields.
export function ContactStep({
  value,
  onChange,
  errors,
  who = "client",
  question,
  showNewFields = true,
}: {
  value: ContactValues;
  onChange: (v: ContactValues) => void;
  errors: FieldErrors;
  who?: "client" | "vendor" | "applicant";
  question?: string;
  showNewFields?: boolean;
}) {
  const [check, setCheck] = useState<"idle" | "checking" | "known" | "unknown">("idle");
  const set = (patch: Partial<ContactValues>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (!value.returning) return;
    const phone = value.phone.trim();
    const email = value.email.trim();
    if (phone.replace(/\D/g, "").length < 9 && !/^\S+@\S+\.\S+$/.test(email)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCheck("checking");
      try {
        const res = await apiGet<{ known: boolean }>("/api/v1/public/contact-check", { for: who, phone: phone || undefined, email: email || undefined }, { signal: ctrl.signal });
        setCheck(res.ok ? (res.data.known ? "known" : "unknown") : "idle");
      } catch {
        /* aborted */
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value.returning, value.phone, value.email, who]);

  const showNew = showNewFields && !value.returning;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">{question ?? "Have you used Marino before?"}</p>
        <Segmented
          name="returning"
          value={value.returning ? "yes" : "no"}
          onChange={(v) => {
            setCheck("idle");
            set({ returning: v === "yes" });
          }}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      </div>

      {value.returning && <p className="text-sm text-muted">Enter the phone number or email you used before. We never show your stored details.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" name="phone" error={errors.phone} hint="e.g. 078 123 4567">
          <Input placeholder="+250 788 123 456" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(e) => set({ phone: e.target.value })} invalid={!!errors.phone} />
        </Field>
        <Field label="Email" name="email" error={errors.email} optional={!!value.phone}>
          <Input placeholder="name@example.rw" name="email" type="email" autoComplete="email" value={value.email} onChange={(e) => set({ email: e.target.value })} invalid={!!errors.email} />
        </Field>
      </div>

      {value.returning && check !== "idle" && (
        <div className="flex items-center gap-2 text-sm">
          {check === "checking" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted" /> Checking…
            </>
          )}
          {check === "known" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" /> Welcome back. We will use your saved details.
            </>
          )}
          {check === "unknown" && (
            <span className="text-warning">
              We could not find this contact.{" "}
              <button type="button" className="font-semibold underline" onClick={() => set({ returning: false })}>
                Enter your details instead
              </button>
            </span>
          )}
        </div>
      )}

      {showNew && (
        <div className="space-y-4 animate-fade-up">
          <Field label={who === "vendor" ? "Your name or business name" : "Your name"} name="name" error={errors.name ?? errors.contactName}>
            <Input placeholder="e.g. Jean Mugisha" name="name" autoComplete="name" value={value.name} onChange={(e) => set({ name: e.target.value })} invalid={!!(errors.name ?? errors.contactName)} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">You are</p>
            <Segmented
              name="entityType"
              value={value.entityType}
              onChange={(v) => set({ entityType: v })}
              options={[
                { value: "INDIVIDUAL", label: "An individual" },
                { value: "COMPANY", label: "A company" },
              ]}
            />
          </div>
          {value.entityType === "COMPANY" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" name="companyName" error={errors.companyName}>
                <Input placeholder="e.g. Ubaka Builders Ltd" name="companyName" value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} invalid={!!errors.companyName} />
              </Field>
              <Field label="TIN" name="tin" error={errors.tin} optional hint="9 digits">
                <Input placeholder="9 digits, e.g. 102345678" name="tin" inputMode="numeric" value={value.tin} onChange={(e) => set({ tin: e.target.value })} invalid={!!errors.tin} />
              </Field>
            </div>
          )}
          <Field label="District" name="district" error={errors.district} optional>
            <Select name="district" value={value.district} onChange={(e) => set({ district: e.target.value })}>
              <option value="">Choose a district</option>
              {RWANDA_DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

// The contact part of a public request input.
export function contactInput(c: ContactValues) {
  return {
    returning: c.returning,
    phone: c.phone,
    email: c.email,
    name: c.returning ? "" : c.name,
    entityType: c.entityType,
    companyName: c.entityType === "COMPANY" && !c.returning ? c.companyName : "",
    tin: c.entityType === "COMPANY" && !c.returning ? c.tin : "",
    district: c.returning ? "" : c.district,
  };
}

// The honeypot: hidden from people, tempting for bots (DNSA 23.2).
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Fax number
        <input type="text" name="fax" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
