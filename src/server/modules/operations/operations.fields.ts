// OPERATIONS FIELDS: shared Zod field rules. CLIENT-SAFE: forms import this file.
// Enum values are literal arrays here, never imported from the Prisma client.
// The contact rules are this module's own copy on purpose (DNSA 9.3).

import { z } from "zod";

export const id = z.uuid("Invalid id.");

export const DIVISIONS = ["EQUIPMENT", "TRAINING", "INSPECTION_TESTING", "MATERIALS", "WASTE_MANAGEMENT", "WORKFORCE", "ENGINEERING", "PAINT_RWANDA"] as const;
export const EQUIPMENT_REQUEST_TYPES = ["RENT", "BUY"] as const;
export const EQUIPMENT_REQUEST_STATUSES = ["NEW", "QUOTED", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const SUPPLY_ORDER_STATUSES = ["NEW", "QUOTED", "CONFIRMED", "DELIVERED", "CANCELLED"] as const;
export const SERVICE_REQUEST_STATUSES = ["NEW", "QUOTED", "SCHEDULED", "IN_PROGRESS", "DELIVERED", "CANCELLED"] as const;
export const WORKFORCE_REQUEST_STATUSES = ["NEW", "RECRUITING", "FILLED", "CLOSED"] as const;
export const APPLICATION_STATUSES = ["NEW", "SHORTLISTED", "PLACED", "REJECTED"] as const;
export const REQUEST_SOURCES = ["WEBSITE", "PHONE", "WHATSAPP", "WALK_IN"] as const;
export const STAFF_SOURCES = ["PHONE", "WHATSAPP", "WALK_IN"] as const;
export const PAYMENT_PLANS = ["FULL", "INSTALLMENT"] as const;
export const PARTY_TYPES = ["INDIVIDUAL", "COMPANY"] as const;
export const GENDERS = ["MALE", "FEMALE"] as const;

export const requiredText = (min: number, max: number) =>
  z.string().trim().min(min, min === 1 ? "Required." : `Must be at least ${min} characters.`).max(max, `Must be at most ${max} characters.`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const hasChanges =
  (fixed: readonly string[]) =>
  (data: Record<string, unknown>): boolean =>
    Object.entries(data).some(([key, value]) => !fixed.includes(key) && value !== undefined);

// Money is Int RWF (D-5).
export const rwf = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(/[,\s]/g, ""))) : v),
  z.number({ error: "Enter an amount in RWF." }).int("Whole francs only.").min(1, "Must be more than 0.").max(10_000_000_000).nullable(),
);

// A calendar day "YYYY-MM-DD"; "" means none.
export const optionalDate = z.iso.date("Enter a valid date.").or(z.literal("")).nullish().transform((v) => (v ? v : null));

// ---------- Contact ("Have you used Marino before?") ----------

export function normalizePhone(raw: string): string | null {
  const v = raw.replace(/[\s().-]/g, "");
  const m = v.match(/^(?:\+?250|0)?(7\d{8})$/);
  return m ? `+250${m[1]}` : null;
}

export const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a Rwandan mobile number, e.g. 078 123 4567." });
      return z.NEVER;
    }
    return phone;
  });

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.email("Enter a valid email.").nullable());

export const tin = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v.replace(/\s/g, "") : null))
  .pipe(z.string().regex(/^\d{9}$/, "TIN is 9 digits.").nullable());

export const clientContactFields = {
  returning: z.boolean(),
  phone: optionalPhone,
  email: optionalEmail,
  name: optionalText(120),
  entityType: z.enum(PARTY_TYPES).default("INDIVIDUAL"),
  companyName: optionalText(160),
  tin,
  district: optionalText(80),
};

type Contact = { returning: boolean; phone: string | null; email: string | null; name: string | null; entityType: string; companyName: string | null };

export function checkClientContact(d: Contact, ctx: z.RefinementCtx) {
  if (!d.phone && !d.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number or an email." });
  if (d.returning) return;
  if (!d.name || d.name.length < 2) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter your name." });
  if (d.entityType === "COMPANY" && !d.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name." });
}

export const publicFormFields = {
  consent: z.literal(true, { error: "Please agree so we can store your details." }),
  fax: z.string().max(200).optional(), // honeypot: real users never see it
  turnstileToken: z.string().max(4096).optional(),
};

// handler=me | none | <user id>
export const handlerParam = z
  .string()
  .trim()
  .refine((v) => v === "me" || v === "none" || /^[0-9a-f-]{36}$/i.test(v))
  .optional()
  .catch(undefined);
