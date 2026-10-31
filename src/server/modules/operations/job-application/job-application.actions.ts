"use server";
// JOB APPLICATION ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { OPS_PATHS } from "../operations.config";
import { applicationIdSchema, setApplicationStatusSchema, submitApplicationSchema } from "./job-application.schema";
import * as jobApplicationService from "./job-application.service";

const refresh = () => {
  revalidatePath(OPS_PATHS.workforceRequests, "layout");
  revalidatePath("/admin/applicants", "layout");
};

// PUBLIC: "Apply" on a job post (new and returning applicants).
// Protection: strict schema; consent required to create a profile (D-8);
// honeypot `fax` (fake success, nothing saved); Turnstile; 5 per minute per
// hashed IP; only open posts; one application per applicant per post; a
// stored profile is never changed; the reply is { received: true } only.
export const submitApplication = createAction({
  access: "public",
  schema: submitApplicationSchema,
  handler: async ({ input }) => {
    const result = await jobApplicationService.submitApplication(input, await getRequestMeta());
    refresh();
    return result;
  },
});

export const setApplicationStatus = createAction({
  access: "job-application:update",
  schema: setApplicationStatusSchema,
  handler: async ({ input }) => {
    const row = await jobApplicationService.setApplicationStatus(input);
    refresh();
    return row;
  },
});

export const deleteApplication = createAction({
  access: "job-application:delete",
  schema: applicationIdSchema,
  handler: async ({ input }) => {
    const row = await jobApplicationService.deleteApplication(input);
    refresh();
    return row;
  },
});
