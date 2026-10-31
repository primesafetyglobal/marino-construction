// PARTIES FIELDS: shared Zod field rules. CLIENT-SAFE: forms import this file.
// Enum values are literal arrays here, never imported from the Prisma client.

import { z } from "zod";

export const id = z.uuid("Invalid id.");

export const PARTY_TYPES = ["INDIVIDUAL", "COMPANY"] as const;
export const VENDOR_TYPES = ["EQUIPMENT_OWNER", "SUPPLIER", "GARAGE", "TECHNICIAN", "CONTRACTOR", "RECYCLER", "OTHER"] as const;
export const VENDOR_STATUSES = ["PENDING", "APPROVED", "INACTIVE"] as const;
export const GENDERS = ["MALE", "FEMALE"] as const;
export const PAYMENT_STATUSES = ["DUE", "PAID"] as const;
export const PAYMENT_METHODS = ["CASH", "MOMO", "BANK"] as const;
export const PAYABLE_TYPES = ["EQUIPMENT_REQUEST", "SUPPLY_ORDER", "SERVICE_REQUEST"] as const;

export const VENDOR_TYPE_LABEL: Record<(typeof VENDOR_TYPES)[number], string> = {
  EQUIPMENT_OWNER: "Equipment owner",
  SUPPLIER: "Supplier",
  GARAGE: "Garage",
  TECHNICIAN: "Technician",
  CONTRACTOR: "Contractor",
  RECYCLER: "Recycler",
  OTHER: "Other",
};

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

// PTY-R1: Rwandan mobile numbers are stored as +2507XXXXXXXX.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/[\s().-]/g, "");
  const m = v.match(/^(?:\+?250|0)?(7\d{8})$/);
  return m ? `+250${m[1]}` : null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  return v ? v : null;
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

// PTY-R2.
export const tin = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v.replace(/\s/g, "") : null))
  .pipe(z.string().regex(/^\d{9}$/, "TIN is 9 digits.").nullable());

// Money is Int RWF (D-5).
export const rwf = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(/[,\s]/g, ""))) : v),
  z.number({ error: "Enter an amount in RWF." }).int("Whole francs only.").min(1, "Must be more than 0.").max(10_000_000_000),
);

// A calendar day, "YYYY-MM-DD" (DNSA ch. 18).
export const dateOnly = z.iso.date("Enter a valid date.");
export const optionalDateOnly = dateOnly.or(z.literal("")).nullish().transform((v) => (v ? v : null));

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), "Must be a valid link (https://…).");
export const optionalUrl = httpsUrl.or(z.literal("")).nullish().transform((v) => (v ? v : null));

export function checkPhoneOrEmail(d: { phone?: string | null; email?: string | null }, ctx: z.RefinementCtx) {
  if (!d.phone && !d.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number or an email." });
}

export function checkCompany(d: { entityType?: string; companyName?: string | null }, ctx: z.RefinementCtx) {
  if (d.entityType === "COMPANY" && !d.companyName) {
    ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name." });
  }
}

export const publicFormFields = {
  consent: z.literal(true, { error: "Please agree so we can store your details." }),
  fax: z.string().max(200).optional(), // honeypot: real users never see it
  turnstileToken: z.string().max(4096).optional(),
};
