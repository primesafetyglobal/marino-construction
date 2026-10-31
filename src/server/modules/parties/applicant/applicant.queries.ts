// APPLICANT QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getApplicantSchema, listApplicantsSchema } from "./applicant.schema";
import * as applicantService from "./applicant.service";

export const listApplicants = createQuery({
  access: "applicant:read",
  schema: listApplicantsSchema,
  handler: ({ input }) => applicantService.listApplicants(input),
});

// With applications and a short-lived CV link.
export const getApplicant = createQuery({
  access: "applicant:read",
  schema: getApplicantSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await applicantService.getApplicantDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Applicant");
    return row;
  },
});
