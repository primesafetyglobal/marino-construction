// ACCESS FIELDS: shared Zod field rules. CLIENT-SAFE: forms import this file.

import { z } from "zod";
import { ACCESS_CONFIG } from "./access.config";

export const id = z.uuid("Invalid id.");

export const ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
export const REVIEW_STATUSES = ["NEW", "PUBLIC", "PRIVATE"] as const;
export const DIVISIONS = ["EQUIPMENT", "TRAINING", "INSPECTION_TESTING", "MATERIALS", "WASTE_MANAGEMENT", "WORKFORCE", "ENGINEERING", "PAINT_RWANDA"] as const;

// ACC-R16: the roles an actor may give.
export function assignableRolesFor(role: (typeof ROLES)[number]): (typeof ROLES)[number][] {
  return role === "SUPER_ADMIN" ? ["SUPER_ADMIN", "ADMIN", "STAFF"] : ["ADMIN", "STAFF"];
}

export const ROLE_LABEL: Record<(typeof ROLES)[number], string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", STAFF: "Staff" };

export const requiredText = (min: number, max: number) =>
  z.string().trim().min(min, min === 1 ? "Required." : `Must be at least ${min} characters.`).max(max, `Must be at most ${max} characters.`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email."));

// ACC-R8.
export const password = z
  .string()
  .min(ACCESS_CONFIG.passwords.min, `Use at least ${ACCESS_CONFIG.passwords.min} characters.`)
  .max(ACCESS_CONFIG.passwords.max, "That password is too long.");

export const token = z.string().trim().min(20).max(1000);

export const hasChanges =
  (fixed: readonly string[]) =>
  (data: Record<string, unknown>): boolean =>
    Object.entries(data).some(([key, value]) => !fixed.includes(key) && value !== undefined);

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

export const publicFormFields = {
  consent: z.literal(true, { error: "Please agree so we can store your details." }),
  fax: z.string().max(200).optional(), // honeypot
  turnstileToken: z.string().max(4096).optional(),
};
