// JOB APPLICATION SCHEMA: what input is allowed.
// CLIENT-SAFE: forms import this file. No server imports.

import { z } from "zod";
import { enumParam, listQuery, uuidParam } from "@/server/validation/pagination";
import {
  APPLICATION_STATUSES,
  GENDERS,
  id,
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
} from "../operations.fields";

const tags = z.array(z.string().trim().min(1).max(60)).max(20);

// The apply sheet: "Have you applied with us before?" (OPS-R12, R13).
// D-8: consent is required to create a profile; a returning applicant already
// gave it (Applicant.consentAt), so it is only demanded when `returning` is false.
export const submitApplicationSchema = z
  .strictObject({
    jobNumber: z.coerce.number().int().min(1),
    returning: z.boolean(),
    phone: optionalPhone,
    email: optionalEmail,
    message: optionalText(1000),
    fullName: optionalText(120),
    dateOfBirth: optionalDate,
    gender: z.enum(GENDERS).nullish(),
    trade: optionalText(80),
    experience: optionalText(2000),
    district: optionalText(80),
    cv: z.string().startsWith("upload:").max(4000).nullish(),
    details: z
      .strictObject({
        educationLevel: optionalText(80).optional(),
        languages: tags.optional(),
        skills: tags.optional(),
        certifications: tags.optional(),
        nationality: optionalText(60).optional(),
      })
      .nullish(),
    consent: z.boolean().default(false),
    fax: z.string().max(200).optional(), // honeypot
    turnstileToken: z.string().max(4096).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.phone && !d.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number or an email." });
    if (d.returning) return;
    if (!d.fullName || d.fullName.length < 2) ctx.addIssue({ code: "custom", path: ["fullName"], message: "Enter your full name." });
    if (!d.dateOfBirth) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter your date of birth." });
    if (!d.trade) ctx.addIssue({ code: "custom", path: ["trade"], message: "Enter your trade." });
    if (!d.experience) ctx.addIssue({ code: "custom", path: ["experience"], message: "Describe your experience." });
    if (d.consent !== true) ctx.addIssue({ code: "custom", path: ["consent"], message: "Please agree so we can store your profile." });
  });

export const setApplicationStatusSchema = z.strictObject({ id, status: z.enum(APPLICATION_STATUSES), notes: optionalText(2000) });
export const applicationIdSchema = z.strictObject({ id });

export const listApplicationsSchema = listQuery.extend({
  workforceRequestId: uuidParam,
  applicantId: uuidParam,
  status: enumParam(APPLICATION_STATUSES),
});
export const getApplicationSchema = z.object({ id });
export const applicationsByRequestSchema = z.object({ workforceRequestId: id });
export const applicationsByApplicantSchema = z.object({ applicantId: id });

export type SubmitApplicationInput = z.input<typeof submitApplicationSchema>;
export type SubmitApplicationData = z.output<typeof submitApplicationSchema>;
export type SetApplicationStatusData = z.output<typeof setApplicationStatusSchema>;
export type ApplicationIdData = z.output<typeof applicationIdSchema>;
export type ListApplicationsData = z.output<typeof listApplicationsSchema>;
