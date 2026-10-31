"use client";

// "Request workers", shown inline at the top of the Workforce page (Design §6).

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { whatsappHref } from "@/config/site";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Turnstile } from "@/components/ui/turnstile";
import { todayKigali } from "@/lib/format";
import { useActionForm } from "@/lib/forms";
import { submitWorkforceRequest } from "@/server/modules/operations/workforce-request/workforce-request.actions";
import { submitWorkforceRequestSchema } from "@/server/modules/operations/workforce-request/workforce-request.schema";
import { ContactStep, contactInput, emptyContact, Honeypot, type ContactValues } from "./contact-step";

export function WorkforceInlineForm() {
  const [v, setV] = useState({ role: "", quantity: "1", duration: "", siteLocation: "", startDate: "", details: "" });
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [code, setCode] = useState<string | null>(null);
  const form = useActionForm<{ code: string }>();
  const e = form.errors;

  if (code) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="text-lg font-semibold">Request received</p>
        <p className="rounded-2xl bg-mist px-6 py-2 font-mono text-2xl font-bold" data-testid="request-code">
          {code}
        </p>
        <p className="text-muted">We&apos;ll contact you shortly.</p>
        <a href={whatsappHref(`Hello Marino, about my request ${code}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("dark")}>
          <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      className="relative space-y-5"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const result = await form.run({
          schema: submitWorkforceRequestSchema,
          input: { ...v, ...contactInput(contact), consent: consent as true, fax, turnstileToken: token },
          action: submitWorkforceRequest,
        });
        if (result) setCode(result.code);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" name="role" error={e.role}>
          <Input name="role" placeholder="e.g. Masons, Excavator operator" value={v.role} onChange={(x) => setV({ ...v, role: x.target.value })} invalid={!!e.role} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Workers" name="quantity" error={e.quantity}>
            <Input placeholder="e.g. 4" type="number" min={1} name="quantity" value={v.quantity} onChange={(x) => setV({ ...v, quantity: x.target.value })} />
          </Field>
          <Field label="Duration" name="duration" error={e.duration}>
            <Input name="duration" placeholder="3 months" value={v.duration} onChange={(x) => setV({ ...v, duration: x.target.value })} invalid={!!e.duration} />
          </Field>
        </div>
        <Field label="Site" name="siteLocation" error={e.siteLocation}>
          <Input name="siteLocation" placeholder="District" value={v.siteLocation} onChange={(x) => setV({ ...v, siteLocation: x.target.value })} invalid={!!e.siteLocation} />
        </Field>
        <Field label="Start date" name="startDate" error={e.startDate} optional>
          <Input type="date" name="startDate" min={todayKigali()} value={v.startDate} onChange={(x) => setV({ ...v, startDate: x.target.value })} />
        </Field>
      </div>
      <Field label="Notes" name="details" optional>
        <Textarea placeholder="Internal notes, never shown to the client" name="details" value={v.details} onChange={(x) => setV({ ...v, details: x.target.value })} className="min-h-16" />
      </Field>
      <div className="border-t border-line/60 pt-5">
        <ContactStep value={contact} onChange={setContact} errors={e} />
      </div>
      <Checkbox
        checked={consent}
        onChange={(x) => setConsent(x.target.checked)}
        label={
          <span>
            I agree that Marino stores my contact details to handle this request.
            {e.consent && <span className="block text-xs font-medium text-danger">{e.consent[0]}</span>}
          </span>
        }
      />
      <Honeypot value={fax} onChange={setFax} />
      <Turnstile onToken={setToken} />
      <FormError message={form.formError?.code === "VALIDATION" && form.formError.fieldErrors ? null : form.formError?.message} />
      <Button type="submit" size="lg" disabled={form.pending}>
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Request workers
      </Button>
    </form>
  );
}
