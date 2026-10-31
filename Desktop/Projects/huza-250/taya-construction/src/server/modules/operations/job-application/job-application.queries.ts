// JOB APPLICATION QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import {
  applicationsByApplicantSchema,
  applicationsByRequestSchema,
  getApplicationSchema,
  listApplicationsSchema,
} from "./job-application.schema";
import * as jobApplicationService from "./job-application.service";

export const listApplications = createQuery({
  access: "job-application:read",
  schema: listApplicationsSchema,
  handler: ({ input }) => jobApplicationService.listApplications(input),
});

export const getApplication = createQuery({
  access: "job-application:read",
  schema: getApplicationSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await jobApplicationService.getApplicationDetail(input.id);
    if (!row) throw Errors.notFound("Application");
    return row;
  },
});

// The applicants table of a workforce request.
export const getApplicationsByRequest = createQuery({
  access: "job-application:read",
  schema: applicationsByRequestSchema,
  handler: ({ input }) => jobApplicationService.listApplications({ q: undefined, workforceRequestId: input.workforceRequestId, limit: 100 }),
});

export const getApplicationsByApplicant = createQuery({
  access: "job-application:read",
  schema: applicationsByApplicantSchema,
  handler: ({ input }) => jobApplicationService.listApplications({ q: undefined, applicantId: input.applicantId, limit: 100 }),
});
