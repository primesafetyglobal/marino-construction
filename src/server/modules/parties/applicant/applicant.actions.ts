"use server";
// APPLICANT ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { PARTIES_PATHS } from "../parties.config";
import { applicantIdSchema, cvUploadTicketSchema, updateApplicantSchema } from "./applicant.schema";
import * as applicantService from "./applicant.service";

const refresh = () => {
  revalidatePath(PARTIES_PATHS.applicants, "layout");
};

export const updateApplicant = createAction({
  access: "applicant:update",
  schema: updateApplicantSchema,
  handler: async ({ input }) => {
    const row = await applicantService.updateApplicant(input);
    refresh();
    return row;
  },
});

export const deleteApplicant = createAction({
  access: "applicant:delete",
  schema: applicantIdSchema,
  handler: async ({ input }) => {
    const row = await applicantService.deleteApplicant(input);
    refresh();
    return row;
  },
});

// PUBLIC: CV upload ticket for the apply form (new applicants).
// Protection: strict schema; PDF only, ≤ 5 MB (parties.config); 10 per
// minute per hashed IP; the reply holds a signed URL and token, never a key.
export const createCvUploadTicket = createAction({
  access: "public",
  schema: cvUploadTicketSchema,
  handler: async ({ input }) => applicantService.createCvUploadTicket(input, await getRequestMeta()),
});
