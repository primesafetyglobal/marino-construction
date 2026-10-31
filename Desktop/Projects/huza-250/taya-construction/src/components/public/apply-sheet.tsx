"use client";

// "Apply" on a job post (Design §6): "Have you applied with us before?"
// Yes: phone or email + optional message. No: the profile form (once), CV,
// "More about you", consent. Both call submitApplication.

import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Turnstile } from "@/components/ui/turnstile";
import { UploadField } from "@/components/ui/upload";
import { useActionForm } from "@/lib/forms";
import { submitApplication } from "@/server/modules/operations/job-application/job-application.actions";
import { submitApplicationSchema } from "@/server/modules/operations/job-application/job-application.schema";
import { createCvUploadTicket } from "@/server/modules/parties/applicant/applicant.actions";
import { ContactStep, emptyContact, Honeypot, RWANDA_DISTRICTS, type ContactValues } from "./contact-step";

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function ApplyButton({ jobNumber, role, uploadsEnabled }: { jobNumber: number; role: string; uploadsEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)} data-testid="apply-open">
        Apply
      </Button>
      {open && <ApplySheet jobNumber={jobNumber} role={role} uploadsEnabled={uploadsEnabled} onClose={() => setOpen(false)} />}
    </>
  );
}

function ApplySheet({ jobNumber, role, uploadsEnabled, onClose }: { jobNumber: number; role: string; uploadsEnabled: boolean; onClose: () => void }) {
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [p, setP] = useState({ fullName: "", dateOfBirth: "", gender: "", trade: "", experience: "", district: "", message: "" });
  const [more, setMore] = useState({ educationLevel: "", languages: "", skills: "", certifications: "", nationality: "" });
  const [showMore, setShowMore] = useState(false);
  const [cv, setCv] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const form = useActionForm<{ received: true }>();
  const e = form.errors;
  const set = (patch: Partial<typeof p>) => setP((v) => ({ ...v, ...patch }));

  async function submit() {
    const isNew = !contact.returning;
    const details = { educationLevel: more.educationLevel, languages: split(more.languages), skills: split(more.skills), certifications: split(more.certifications), nationality: more.nationality };
    const input = {
      jobNumber,
      returning: contact.returning,
      phone: contact.phone,
      email: contact.email,
      message: p.message,
      ...(isNew
        ? { fullName: p.fullName, dateOfBirth: p.dateOfBirth, gender: p.gender || null, trade: p.trade, experience: p.experience, district: p.district, cv: cv[0] ?? null, details, consent }
        : { consent: false }),
      fax,
      turnstileToken: token,
    };
    const result = await form.run({ schema: submitApplicationSchema, input, action: submitApplication });
    if (result) setDone(true);
  }

  if (done) {
    return (
      <Sheet open onClose={onClose} title="Application received">
        <div className="flex flex-col items-center gap-3 py-10 text-center animate-fade-up">
          <CheckCircle2 className="h-14 w-14 text-success" />
          <p className="text-lg font-semibold" data-testid="apply-success">
            Application received
          </p>
          <p className="text-muted">Thank you. Our team will review it and contact you if you are shortlisted.</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Apply: ${role}`}
      wide
      footer={
        <Button size="lg" className="w-full" onClick={submit} disabled={form.pending} data-testid="apply-submit">
          {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Submit application
        </Button>
      }
    >
      <div className="relative space-y-5">
        <ContactStep value={contact} onChange={setContact} errors={e} who="applicant" question="Have you applied with us before?" showNewFields={false} />

        {!contact.returning && (
          <div className="space-y-4 border-t border-line/60 pt-5 animate-fade-up">
            <p className="text-sm font-semibold">Your profile (once only)</p>
            <Field label="Full name" name="fullName" error={e.fullName}>
              <Input placeholder="e.g. Jean Mugisha" name="fullName" value={p.fullName} onChange={(x) => set({ fullName: x.target.value })} invalid={!!e.fullName} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" name="dateOfBirth" error={e.dateOfBirth} hint="You must be 18 or older.">
                <Input type="date" name="dateOfBirth" value={p.dateOfBirth} onChange={(x) => set({ dateOfBirth: x.target.value })} invalid={!!e.dateOfBirth} />
              </Field>
              <Field label="Gender" name="gender" optional>
                <Select name="gender" value={p.gender} onChange={(x) => set({ gender: x.target.value })}>
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </Field>
              <Field label="Trade" name="trade" error={e.trade}>
                <Input name="trade" placeholder="e.g. Mason, Excavator operator" value={p.trade} onChange={(x) => set({ trade: x.target.value })} invalid={!!e.trade} />
              </Field>
              <Field label="District" name="district" optional>
                <Select name="district" value={p.district} onChange={(x) => set({ district: x.target.value })}>
                  <option value="">Choose a district</option>
                  {RWANDA_DISTRICTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Experience" name="experience" error={e.experience} hint="Years of experience and past projects.">
              <Textarea placeholder="e.g. 5 years on building sites" name="experience" value={p.experience} onChange={(x) => set({ experience: x.target.value })} invalid={!!e.experience} />
            </Field>
            <Field label="CV (PDF, up to 5 MB)" optional error={e.cv ?? e.cvUrl}>
              <UploadField enabled={uploadsEnabled} value={cv} onChange={setCv} getTicket={createCvUploadTicket} accept="application/pdf" multiple={false} label="Upload your CV" mode="file" maxMb={5} />
            </Field>
            <button type="button" className="flex items-center gap-1 text-sm font-semibold" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              More about you <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
            </button>
            {showMore && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Education level" optional>
                  <Input placeholder="e.g. A2 in Masonry (TVET)" value={more.educationLevel} onChange={(x) => setMore({ ...more, educationLevel: x.target.value })} />
                </Field>
                <Field label="Nationality" optional>
                  <Input placeholder="e.g. Rwandan" value={more.nationality} onChange={(x) => setMore({ ...more, nationality: x.target.value })} />
                </Field>
                <Field label="Languages" optional hint="Separate with commas">
                  <Input placeholder="e.g. Kinyarwanda, English, French" value={more.languages} onChange={(x) => setMore({ ...more, languages: x.target.value })} />
                </Field>
                <Field label="Skills" optional hint="Separate with commas">
                  <Input placeholder="e.g. Plastering, tiling, reading drawings" value={more.skills} onChange={(x) => setMore({ ...more, skills: x.target.value })} />
                </Field>
                <Field label="Certifications" optional hint="Separate with commas" className="sm:col-span-2">
                  <Input placeholder="e.g. Working at Heights, First Aid" value={more.certifications} onChange={(x) => setMore({ ...more, certifications: x.target.value })} />
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Message" name="message" optional>
          <Textarea name="message" placeholder="A short note for the recruiter" value={p.message} onChange={(x) => set({ message: x.target.value })} className="min-h-16" />
        </Field>

        {!contact.returning && (
          <Checkbox
            checked={consent}
            onChange={(x) => setConsent(x.target.checked)}
            label={
              <span>
                I agree that Marino stores my profile and CV and shares them with employers for jobs I apply to.
                {e.consent && <span className="block text-xs font-medium text-danger">{e.consent[0]}</span>}
              </span>
            }
          />
        )}
        <Honeypot value={fax} onChange={setFax} />
        <Turnstile onToken={setToken} />
        <FormError message={form.formError && (form.formError.code !== "VALIDATION" || !form.formError.fieldErrors) ? form.formError.message : null} />
      </div>
    </Sheet>
  );
}
