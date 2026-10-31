// USER SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { booleanParam, enumParam, listQuery } from "@/server/validation/pagination";
import { email, hasChanges, id, optionalPhone, password, requiredText, ROLES, token } from "../access.fields";

export const inviteUserSchema = z.strictObject({
  name: requiredText(2, 120),
  email,
  role: z.enum(ROLES),
  phone: optionalPhone,
});

export const updateUserSchema = z
  .strictObject({
    id,
    name: requiredText(2, 120).optional(),
    phone: optionalPhone.optional(),
    role: z.enum(ROLES).optional(),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const setUserActiveSchema = z.strictObject({ id, isActive: z.boolean() });
export const userIdSchema = z.strictObject({ id });

export const changeOwnPasswordSchema = z
  .strictObject({ currentPassword: z.string().min(1, "Enter your current password.").max(200), newPassword: password, confirmPassword: z.string().max(200) })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "The passwords do not match." });

export const requestEmailChangeSchema = z.strictObject({ newEmail: email });

// PUBLIC, token-protected (ACC-R5).
export const acceptInviteSchema = z
  .strictObject({ token, password, confirmPassword: z.string().max(200) })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "The passwords do not match." });
export const resetPasswordSchema = acceptInviteSchema;
export const requestPasswordResetSchema = z.strictObject({ email, turnstileToken: z.string().max(4096).optional() });
export const verifyEmailSchema = z.strictObject({ token });

// Login form: NextAuth adds csrfToken and callbackUrl, so this one is not
// strict (DNSA 41.2: strip unknown fields of library-built input).
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export const listUsersSchema = listQuery.extend({
  role: enumParam(ROLES),
  picker: booleanParam,
  active: booleanParam,
});
export const getUserSchema = z.object({ id });
export const noInput = z.object({});

export type InviteUserInput = z.input<typeof inviteUserSchema>;
export type InviteUserData = z.output<typeof inviteUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateUserData = z.output<typeof updateUserSchema>;
export type SetUserActiveData = z.output<typeof setUserActiveSchema>;
export type UserIdData = z.output<typeof userIdSchema>;
export type ChangeOwnPasswordInput = z.input<typeof changeOwnPasswordSchema>;
export type ChangeOwnPasswordData = z.output<typeof changeOwnPasswordSchema>;
export type AcceptInviteData = z.output<typeof acceptInviteSchema>;
export type ResetPasswordData = z.output<typeof resetPasswordSchema>;
export type ListUsersData = z.output<typeof listUsersSchema>;
