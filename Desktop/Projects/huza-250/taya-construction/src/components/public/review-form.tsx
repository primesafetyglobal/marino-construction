"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DIVISIONS } from "@/config/divisions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { StarInput } from "@/components/ui/stars";
import { Turnstile } from "@/components/ui/turnstile";
import { useActionForm } from "@/lib/forms";
import { submitReview } from "@/server/modules/access/review/review.actions";
import { submitReviewSchema } from "@/server/modules/access/review/review.schema";
import { Honeypot } from "./contact-step";

// "Share your experience" (Design §6). Saved NEW; public only after staff approve.
export function ReviewForm() {
  const [v, setV] = useState({ fullName: "", company: "", phone: "", email: "", division: "", message: "" });
  const [rating, setRating] = useState(0);
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const form = useActionForm<{ received: true }>();
  const e = form.errors;
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="text-lg font-semibold" data-testid="review-success">
          Thank you for your feedback
        </p>
        <p className="text-sm text-muted">Our team reads every review.</p>
      </div>
    );
  }
  return (
    <form
      className="relative space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const result = await form.run({
          schema: submitReviewSchema,
          input: { ...v, division: v.division || null, rating, consent: consent as true, fax, turnstileToken: token },
          action: submitReview,
        });
        if (result) setDone(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="fullName" error={e.fullName}>
          <Input placeholder="e.g. Jean Mugisha" name="fullName" value={v.fullName} onChange={(x) => set({ fullName: x.target.value })} invalid={!!e.fullName} />
        </Field>
        <Field label="Company" name="company" optional>
          <Input placeholder="e.g. Ubaka Builders Ltd" name="company" value={v.company} onChange={(x) => set({ company: x.target.value })} />
        </Field>
        <Field label="Phone" name="phone" optional error={e.phone} hint="Kept private">
          <Input placeholder="+250 788 123 456" name="phone" type="tel" value={v.phone} onChange={(x) => set({ phone: x.target.value })} />
        </Field>
        <Field label="Email" name="email" optional error={e.email} hint="Kept private">
          <Input placeholder="name@example.rw" name="email" type="email" value={v.email} onChange={(x) => set({ email: x.target.value })} />
        </Field>
      </div>
      <Field label="Division" name="division" optional>
        <Select name="division" value={v.division} onChange={(x) => set({ division: x.target.value })}>
          <option value="">General</option>
          {DIVISIONS.map((d) => (
            <option key={d.enum} value={d.enum}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rating" error={e.rating}>
        <StarInput value={rating} onChange={setRating} />
      </Field>
      <Field label="Your message" name="message" error={e.message}>
        <Textarea placeholder="e.g. The excavator arrived on time and the operator was careful on our site." name="message" value={v.message} onChange={(x) => set({ message: x.target.value })} invalid={!!e.message} />
      </Field>
      <Checkbox
        checked={consent}
        onChange={(x) => setConsent(x.target.checked)}
        label={
          <span>
            I agree that Marino stores this review. My name, company, rating and message may be shown publicly; my phone and email never are.
            {e.consent && <span className="block text-xs font-medium text-danger">{e.consent[0]}</span>}
          </span>
        }
      />
      <Honeypot value={fax} onChange={setFax} />
      <Turnstile onToken={setToken} />
      <FormError message={form.formError && (form.formError.code !== "VALIDATION" || !form.formError.fieldErrors) ? form.formError.message : null} />
      <Button type="submit" disabled={form.pending} data-testid="review-submit">
        {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Send review
      </Button>
    </form>
  );
}
