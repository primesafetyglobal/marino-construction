"use client";

// The request sheet (Design §6): opened from any public page, prefilled from
// context, 2 short steps (what you need, then your contact) and a success view
// with the request code and a WhatsApp link. No account.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { DIVISIONS, divisionByEnum, type DivisionEnum } from "@/config/divisions";
import { SITE, whatsappHref } from "@/config/site";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Turnstile } from "@/components/ui/turnstile";
import { DivisionIcon } from "@/components/ui/icons";
import { todayKigali } from "@/lib/format";
import { useActionForm, zodFieldErrors, type FieldErrors } from "@/lib/forms";
import { submitEquipmentRequest } from "@/server/modules/operations/equipment-request/equipment-request.actions";
import { submitEquipmentRequestSchema } from "@/server/modules/operations/equipment-request/equipment-request.schema";
import { submitServiceRequest } from "@/server/modules/operations/service-request/service-request.actions";
import { submitServiceRequestSchema } from "@/server/modules/operations/service-request/service-request.schema";
import { submitSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.actions";
import { submitSupplyOrderSchema } from "@/server/modules/operations/supply-order/supply-order.schema";
import { submitWorkforceRequest } from "@/server/modules/operations/workforce-request/workforce-request.actions";
import { submitWorkforceRequestSchema } from "@/server/modules/operations/workforce-request/workforce-request.schema";
import { ContactStep, contactInput, emptyContact, Honeypot, type ContactValues } from "./contact-step";

export type RequestTarget =
  | { kind: "equipment"; equipmentId?: string; itemName?: string; mode?: "RENT" | "BUY" }
  | { kind: "supply"; productId?: string; itemName?: string }
  | { kind: "service"; serviceId?: string; itemName?: string; division?: DivisionEnum; installments?: boolean }
  | { kind: "workforce"; role?: string };

export type ServiceOption = { id: string; name: string; division: DivisionEnum };

type Ctx = { open: (target?: RequestTarget | null) => void };
const RequestCtx = createContext<Ctx>({ open: () => {} });
export const useRequestSheet = () => useContext(RequestCtx);

export function RequestSheetProvider({ services, children }: { services: ServiceOption[]; children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; target: RequestTarget | null; key: number }>({ open: false, target: null, key: 0 });
  const open = useCallback((target?: RequestTarget | null) => setState((s) => ({ open: true, target: target ?? null, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <RequestCtx.Provider value={value}>
      {children}
      {state.open && <RequestFlow key={state.key} initial={state.target} services={services} onClose={close} />}
    </RequestCtx.Provider>
  );
}

const KIND_FOR: Partial<Record<DivisionEnum, RequestTarget["kind"]>> = {
  EQUIPMENT: "equipment",
  MATERIALS: "supply",
  WORKFORCE: "workforce",
  INSPECTION_TESTING: "service",
  WASTE_MANAGEMENT: "service",
  ENGINEERING: "service",
  PAINT_RWANDA: "service",
};

type Details = {
  type: "RENT" | "BUY";
  details: string;
  siteLocation: string;
  startDate: string;
  endDate: string;
  items: string;
  deliveryLocation: string;
  deliveryDate: string;
  serviceId: string;
  preferredDate: string;
  installments: boolean;
  role: string;
  quantity: string;
  duration: string;
};

function RequestFlow({ initial, services, onClose }: { initial: RequestTarget | null; services: ServiceOption[]; onClose: () => void }) {
  const [target, setTarget] = useState<RequestTarget | null>(initial);
  const [step, setStep] = useState<1 | 2>(1);
  const [d, setD] = useState<Details>({
    type: initial?.kind === "equipment" ? (initial.mode ?? "RENT") : "RENT",
    details: "",
    siteLocation: "",
    startDate: "",
    endDate: "",
    items: initial?.kind === "supply" && initial.itemName ? `${initial.itemName}: ` : "",
    deliveryLocation: "",
    deliveryDate: "",
    serviceId: initial?.kind === "service" ? (initial.serviceId ?? "") : "",
    preferredDate: "",
    installments: initial?.kind === "service" ? !!initial.installments : false,
    role: initial?.kind === "workforce" ? (initial.role ?? "") : "",
    quantity: "1",
    duration: "",
  });
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [stepErrors, setStepErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<string | null>(null);
  const form = useActionForm<{ code: string }>();
  const set = (patch: Partial<Details>) => setD((v) => ({ ...v, ...patch }));
  const errors = { ...stepErrors, ...form.errors };

  const division: DivisionEnum | undefined =
    target?.kind === "service" ? (target.division ?? services.find((s) => s.id === (target.serviceId ?? d.serviceId))?.division) : undefined;
  const isPaint = division === "PAINT_RWANDA";
  const divisionServices = target?.kind === "service" ? services.filter((s) => !target.division || s.division === target.division) : [];

  const build = (): { input: Record<string, unknown>; schema: (typeof SCHEMAS)[keyof typeof SCHEMAS] } | null => {
    if (!target) return null;
    const common = { ...contactInput(contact), consent: consent as true, fax, turnstileToken };
    switch (target.kind) {
      case "equipment":
        return { schema: SCHEMAS.equipment, input: { equipmentId: target.equipmentId ?? null, type: d.type, details: d.details, siteLocation: d.siteLocation, startDate: d.startDate, endDate: d.type === "RENT" ? d.endDate : "", ...common } };
      case "supply":
        return { schema: SCHEMAS.supply, input: { productId: target.productId ?? null, items: d.items, deliveryLocation: d.deliveryLocation, deliveryDate: d.deliveryDate, ...common } };
      case "service":
        return { schema: SCHEMAS.service, input: { serviceId: target.serviceId ?? d.serviceId, details: d.details, siteLocation: d.siteLocation, preferredDate: d.preferredDate, paymentPlan: d.installments ? "INSTALLMENT" : "FULL", ...common } };
      case "workforce":
        return { schema: SCHEMAS.workforce, input: { role: d.role, quantity: d.quantity, duration: d.duration, siteLocation: d.siteLocation, startDate: d.startDate, details: d.details, ...common } };
    }
  };

  // Step 1 is checked with the same schema, keeping only the step 1 fields.
  const STEP2 = new Set(["returning", "phone", "email", "name", "entityType", "companyName", "tin", "district", "consent", "fax", "turnstileToken"]);
  function next() {
    const b = build();
    if (!b) return;
    const check = b.schema.safeParse(b.input);
    const errs = check.success ? {} : Object.fromEntries(Object.entries(zodFieldErrors(check.error)).filter(([k]) => !STEP2.has(k)));
    setStepErrors(errs);
    if (Object.keys(errs).length === 0) setStep(2);
  }

  async function submit() {
    const b = build();
    if (!b || !target) return;
    setStepErrors({});
    const raw = { equipment: submitEquipmentRequest, supply: submitSupplyOrder, service: submitServiceRequest, workforce: submitWorkforceRequest }[target.kind] as (i: unknown) => ReturnType<typeof submitServiceRequest>;
    let serverFields: string[] = [];
    const action = async (i: unknown) => {
      const r = await raw(i);
      if (!r.ok) serverFields = Object.keys(r.error.fieldErrors ?? {});
      return r;
    };
    const result = await form.run({ schema: b.schema, input: b.input, action });
    if (result) setDone(result.code);
    else if (serverFields.some((k) => !STEP2.has(k))) setStep(1);
  }

  const title = done ? "Request received" : !target ? "Request a quote" : target.kind === "equipment" ? "Request equipment" : target.kind === "supply" ? "Request materials" : target.kind === "workforce" ? "Request workers" : "Request a service";

  if (done) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <div className="flex flex-col items-center gap-4 py-8 text-center animate-fade-up">
          <CheckCircle2 className="h-14 w-14 text-success" />
          <p className="text-lg font-semibold">Request received</p>
          <p className="text-sm text-muted">Your request code</p>
          <p className="rounded-2xl bg-mist px-6 py-3 font-mono text-2xl font-bold tracking-wider" data-testid="request-code">
            {done}
          </p>
          <p className="text-muted">We&apos;ll contact you shortly.</p>
          <a href={whatsappHref(`Hello Marino, about my request ${done}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("dark", "lg")}>
            <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
          </a>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Sheet>
    );
  }

  if (!target) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <p className="mb-4 text-sm text-muted">What do you need?</p>
        <ul className="space-y-2">
          {DIVISIONS.map((div) => {
            const kind = KIND_FOR[div.enum];
            const inner = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
                  <DivisionIcon icon={div.icon} className="h-5 w-5 text-charcoal" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{div.name}</span>
                  <span className="block text-xs text-muted">{div.tagline}</span>
                </span>
              </>
            );
            return (
              <li key={div.enum}>
                {kind ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-line/60 px-4 py-3 text-left transition-colors hover:bg-mist"
                    onClick={() => setTarget(kind === "service" ? { kind, division: div.enum, installments: div.enum === "PAINT_RWANDA" } : ({ kind } as RequestTarget))}
                  >
                    {inner}
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </button>
                ) : (
                  <a href={SITE.links.primeSafetyGlobal} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 rounded-2xl border border-line/60 px-4 py-3 transition-colors hover:bg-mist">
                    {inner}
                    <ExternalLink className="h-4 w-4 text-muted" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    );
  }

  const footer =
    step === 1 ? (
      <div className="flex gap-2">
        {!initial && (
          <Button variant="outline" onClick={() => setTarget(null)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <Button className="flex-1" size="lg" onClick={next}>
          Next: your contact <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    ) : (
      <div className="flex gap-2">
        <Button variant="outline" size="lg" onClick={() => setStep(1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button className="flex-1" size="lg" onClick={submit} disabled={form.pending} data-testid="request-submit">
          {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send request
        </Button>
      </div>
    );

  return (
    <Sheet open onClose={onClose} title={title} footer={footer}>
      <ol className="mb-5 flex items-center gap-2 text-xs font-semibold">
        <li className={step === 1 ? "text-ink" : "text-muted"}>1. What you need</li>
        <li className="h-px flex-1 bg-line" />
        <li className={step === 2 ? "text-ink" : "text-muted"}>2. Your contact</li>
      </ol>

      {"itemName" in target && target.itemName && (
        <div className="mb-4 rounded-2xl bg-mist px-4 py-3 text-sm">
          <span className="text-muted">For: </span>
          <span className="font-semibold">{target.itemName}</span>
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-4">
          {target.kind === "equipment" && (
            <>
              <Segmented
                name="type"
                value={d.type}
                onChange={(v) => set({ type: v })}
                options={[
                  { value: "RENT", label: "Rent" },
                  { value: "BUY", label: "Buy" },
                ]}
              />
              {d.type === "RENT" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date" name="startDate" error={errors.startDate} optional>
                    <Input type="date" name="startDate" min={todayKigali()} value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
                  </Field>
                  <Field label="End date" name="endDate" error={errors.endDate} optional>
                    <Input type="date" name="endDate" min={d.startDate || todayKigali()} value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                  </Field>
                </div>
              )}
              <Field label="Site location" name="siteLocation" error={errors.siteLocation}>
                <Input name="siteLocation" placeholder="e.g. Kicukiro, Kigali" value={d.siteLocation} onChange={(e) => set({ siteLocation: e.target.value })} invalid={!!errors.siteLocation} />
              </Field>
              <Field label="What do you need?" name="details" error={errors.details}>
                <Textarea name="details" placeholder={target.equipmentId ? "Duration, operator needed, transport…" : "Type of machine, capacity, duration…"} value={d.details} onChange={(e) => set({ details: e.target.value })} invalid={!!errors.details} />
              </Field>
            </>
          )}

          {target.kind === "supply" && (
            <>
              <Field label="Items and quantities" name="items" error={errors.items}>
                <Textarea name="items" placeholder="e.g. 50 bags cement, 2 trips sand" value={d.items} onChange={(e) => set({ items: e.target.value })} invalid={!!errors.items} />
              </Field>
              <Field label="Delivery location" name="deliveryLocation" error={errors.deliveryLocation}>
                <Input name="deliveryLocation" placeholder="e.g. Gasabo, Kigali" value={d.deliveryLocation} onChange={(e) => set({ deliveryLocation: e.target.value })} invalid={!!errors.deliveryLocation} />
              </Field>
              <Field label="Delivery date" name="deliveryDate" error={errors.deliveryDate} optional>
                <Input type="date" name="deliveryDate" min={todayKigali()} value={d.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} />
              </Field>
            </>
          )}

          {target.kind === "service" && (
            <>
              {!target.serviceId && (
                <Field label="Service" name="serviceId" error={errors.serviceId}>
                  <Select name="serviceId" value={d.serviceId} onChange={(e) => set({ serviceId: e.target.value })} invalid={!!errors.serviceId}>
                    <option value="">Choose a service</option>
                    {divisionServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {target.division ? "" : ` (${divisionByEnum(s.division)?.shortName})`}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Site location" name="siteLocation" error={errors.siteLocation}>
                <Input name="siteLocation" placeholder="e.g. Nyarugenge, Kigali" value={d.siteLocation} onChange={(e) => set({ siteLocation: e.target.value })} invalid={!!errors.siteLocation} />
              </Field>
              <Field label="Details" name="details" error={errors.details}>
                <Textarea name="details" placeholder="Tell us about the site and what you need" value={d.details} onChange={(e) => set({ details: e.target.value })} invalid={!!errors.details} />
              </Field>
              <Field label="Preferred date" name="preferredDate" error={errors.preferredDate} optional>
                <Input type="date" name="preferredDate" min={todayKigali()} value={d.preferredDate} onChange={(e) => set({ preferredDate: e.target.value })} />
              </Field>
              {(isPaint || target.installments) && (
                <Checkbox name="installments" checked={d.installments} onChange={(e) => set({ installments: e.target.checked })} label={<span><strong>Pay in installments</strong>: we paint, you pay later in agreed installments.</span>} />
              )}
            </>
          )}

          {target.kind === "workforce" && (
            <>
              <Field label="Role" name="role" error={errors.role}>
                <Input name="role" placeholder="e.g. Steel fixer, Excavator operator" value={d.role} onChange={(e) => set({ role: e.target.value })} invalid={!!errors.role} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Number of workers" name="quantity" error={errors.quantity}>
                  <Input placeholder="e.g. 4" type="number" min={1} name="quantity" value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} invalid={!!errors.quantity} />
                </Field>
                <Field label="Duration" name="duration" error={errors.duration}>
                  <Input name="duration" placeholder="e.g. 3 months" value={d.duration} onChange={(e) => set({ duration: e.target.value })} invalid={!!errors.duration} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date" name="startDate" error={errors.startDate} optional>
                  <Input type="date" name="startDate" min={todayKigali()} value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
                </Field>
                <Field label="Site" name="siteLocation" error={errors.siteLocation}>
                  <Input name="siteLocation" placeholder="District" value={d.siteLocation} onChange={(e) => set({ siteLocation: e.target.value })} invalid={!!errors.siteLocation} />
                </Field>
              </div>
              <Field label="Notes" name="details" error={errors.details} optional>
                <Textarea placeholder="Internal notes, never shown to the client" name="details" value={d.details} onChange={(e) => set({ details: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      ) : (
        <div className="relative space-y-5">
          <ContactStep value={contact} onChange={setContact} errors={errors} />
          <Checkbox
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label={
              <span>
                I agree that Marino stores my contact details to handle this request and contact me by phone, SMS or email.
                {errors.consent && <span className="block text-xs font-medium text-danger">{errors.consent[0]}</span>}
              </span>
            }
          />
          <Honeypot value={fax} onChange={setFax} />
          <Turnstile onToken={setTurnstileToken} />
          <FormError message={form.formError && !form.formError.fieldErrors ? form.formError.message : form.formError?.code === "RATE_LIMITED" ? "Too many requests. Please wait a minute and try again." : null} />
        </div>
      )}
    </Sheet>
  );
}

const SCHEMAS = {
  equipment: submitEquipmentRequestSchema,
  supply: submitSupplyOrderSchema,
  service: submitServiceRequestSchema,
  workforce: submitWorkforceRequestSchema,
};

// A button that opens the sheet, prefilled from where it sits.
export function RequestButton({ target, children = "Request", className, variant = "primary", size = "md", testId }: { target?: RequestTarget | null; children?: ReactNode; className?: string; variant?: "primary" | "dark" | "outline" | "light"; size?: "sm" | "md" | "lg"; testId?: string }) {
  const { open } = useRequestSheet();
  return (
    <button type="button" data-testid={testId} className={buttonClass(variant, size, className)} onClick={() => open(target)}>
      {children}
    </button>
  );
}
