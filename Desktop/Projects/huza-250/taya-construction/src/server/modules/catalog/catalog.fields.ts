// CATALOG FIELDS: shared Zod field rules. CLIENT-SAFE: forms import this file.
// Enum values are literal arrays here, never imported from the Prisma client.
// Each module keeps its own copy of the contact rules on purpose (DNSA 9.3).

import { z } from "zod";

export const id = z.uuid("Invalid id.");

export const DIVISIONS = [
  "EQUIPMENT",
  "TRAINING",
  "INSPECTION_TESTING",
  "MATERIALS",
  "WASTE_MANAGEMENT",
  "WORKFORCE",
  "ENGINEERING",
  "PAINT_RWANDA",
] as const;
export const CATEGORY_TYPES = ["EQUIPMENT", "PRODUCT", "SERVICE"] as const;
export const EQUIPMENT_STATUSES = ["PENDING", "AVAILABLE", "RENTED", "SOLD", "INACTIVE"] as const;
export const RENT_UNITS = ["DAY", "WEEK", "MONTH", "PROJECT"] as const;
export const PRODUCT_UNITS = ["PIECE", "BAG", "M2", "M3", "TON", "LITRE", "TRIP"] as const;
export const TRAINING_TYPES = ["HSE", "CONSTRUCTION"] as const;
export const PARTY_TYPES = ["INDIVIDUAL", "COMPANY"] as const;
export const VENDOR_TYPES = ["EQUIPMENT_OWNER", "SUPPLIER", "GARAGE", "TECHNICIAN", "CONTRACTOR", "RECYCLER", "OTHER"] as const;

export const requiredText = (min: number, max: number) =>
  z.string().trim().min(min, min === 1 ? "Required." : `Must be at least ${min} characters.`).max(max, `Must be at most ${max} characters.`);

// "" from an empty form field means "no value".
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
  .or(z.literal(""))
  .optional()
  .transform((v) => (v ? v : undefined));

// Money is Int RWF (D-5). Accepts "150,000" from a form.
export const rwf = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(/[,\s]/g, ""))) : v),
  z.number({ error: "Enter an amount in RWF." }).int("Whole francs only.").min(1, "Must be more than 0.").max(10_000_000_000).nullable(),
);

export const sortOrder = z.coerce.number().int().min(0).max(10_000).default(0);

// An image is an https URL (staff may paste one) or "upload:<token>" from an upload ticket.
export const imageRef = z
  .string()
  .trim()
  .max(4000)
  .refine((v) => v.startsWith("upload:") || /^https:\/\/\S+$/.test(v), "Invalid image.");
export const optionalImage = imageRef.or(z.literal("")).nullish().transform((v) => (v ? v : null));
export const imageList = z.array(imageRef).max(10, "At most 10 images.");

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Must be a valid https:// link.");

// Partial update: at least one field besides the fixed ones.
export const hasChanges =
  (fixed: readonly string[]) =>
  (data: Record<string, unknown>): boolean =>
    Object.entries(data).some(([key, value]) => !fixed.includes(key) && value !== undefined);

// ---------- Contact rules (public forms) ----------

// Rwandan mobile numbers are stored as +2507XXXXXXXX.
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

// Fields of the "Have you worked with Marino before?" step for vendors.
export const vendorContactFields = {
  returning: z.boolean(),
  phone: optionalPhone,
  email: optionalEmail,
  contactName: optionalText(120),
  entityType: z.enum(PARTY_TYPES).default("INDIVIDUAL"),
  companyName: optionalText(160),
  tin,
  district: optionalText(80),
};

type VendorContact = {
  returning: boolean;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  entityType: string;
  companyName: string | null;
};

export function checkVendorContact(d: VendorContact, ctx: z.RefinementCtx) {
  if (!d.phone && !d.email) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number or an email." });
  }
  if (d.returning) return;
  if (!d.contactName || d.contactName.length < 2) {
    ctx.addIssue({ code: "custom", path: ["contactName"], message: "Enter your name." });
  }
  if (d.entityType === "COMPANY" && !d.companyName) {
    ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter the company name." });
  }
}

// Public form protection fields (DNSA 23.2).
export const publicFormFields = {
  consent: z.literal(true, { error: "Please agree so we can store your details." }),
  fax: z.string().max(200).optional(), // honeypot: real users never see it
  turnstileToken: z.string().max(4096).optional(),
};
