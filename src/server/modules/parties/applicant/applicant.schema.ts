// APPLICANT SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.
//
// Applicants are created only by job applications (operations,
// submitApplication → findOrCreateApplicant). Staff update the profile here.

import { z } from "zod";
import { enumParam, intParam, listQuery, textParam } from "@/server/validation/pagination";
import { dateOnly, GENDERS, hasChanges, id, optionalEmail, optionalPhone, optionalText, requiredText } from "../parties.fields";

const tags = z.array(z.string().trim().min(1).max(60)).max(20);

// The fixed shape of Applicant.details (Data Model).
export const applicantDetailsSchema = z.strictObject({
  educationLevel: optionalText(80).optional(),
  languages: tags.optional(),
  skills: tags.optional(),
  certifications: tags.optional(),
  nationality: optionalText(60).optional(),
});
export type ApplicantDetails = z.output<typeof applicantDetailsSchema>;

const cvRef = z
  .string()
  .trim()
  .max(4000)
  .refine((v) => v.startsWith("upload:") || /^https:\/\/\S+$/.test(v), "Invalid file.")
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v ? v : null));

export const updateApplicantSchema = z
  .strictObject({
    id,
    fullName: requiredText(2, 120).optional(),
    phone: optionalPhone.optional(),
    email: optionalEmail.optional(),
    dateOfBirth: dateOnly.optional(),
    gender: z.enum(GENDERS).nullish(),
    trade: requiredText(2, 80).optional(),
    experience: requiredText(2, 2000).optional(),
    district: optionalText(80),
    cvUrl: cvRef.optional(),
    details: applicantDetailsSchema.nullish(),
    notes: optionalText(4000),
  })
  .refine(hasChanges(["id"]), { message: "Nothing to update." });

export const applicantIdSchema = z.strictObject({ id });

// PUBLIC: CV upload ticket for the apply form (PDF only).
export const cvUploadTicketSchema = z.strictObject({
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

export const listApplicantsSchema = listQuery.extend({
  trade: textParam(80),
  district: textParam(80),
  gender: enumParam(GENDERS),
  minAge: intParam,
  maxAge: intParam,
});
export const getApplicantSchema = z.object({ id });

export type UpdateApplicantInput = z.input<typeof updateApplicantSchema>;
export type UpdateApplicantData = z.output<typeof updateApplicantSchema>;
export type ApplicantIdData = z.output<typeof applicantIdSchema>;
export type ListApplicantsData = z.output<typeof listApplicantsSchema>;
