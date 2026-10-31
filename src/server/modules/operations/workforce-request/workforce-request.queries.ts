// WORKFORCE REQUEST QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getJobSchema, getWorkforceRequestSchema, listJobsSchema, listWorkforceRequestsSchema } from "./workforce-request.schema";
import * as workforceRequestService from "./workforce-request.service";

export const listWorkforceRequests = createQuery({
  access: "workforce-request:read",
  schema: listWorkforceRequestsSchema,
  handler: ({ input, user }) => workforceRequestService.listWorkforceRequests(input, { actor: user }),
});

export const getWorkforceRequest = createQuery({
  access: "workforce-request:read",
  schema: getWorkforceRequestSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await workforceRequestService.getWorkforceRequestDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Request");
    return row;
  },
});

// PUBLIC: open job posts only (OPS-R11), job-post select only.
export const getOpenJobs = createQuery({
  access: "public",
  schema: listJobsSchema,
  handler: ({ input }) => workforceRequestService.listOpenJobs(input),
});

// PUBLIC: one open job post by number; anything else answers NOT_FOUND.
export const getJobByNumber = createQuery({
  access: "public",
  schema: getJobSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const job = await workforceRequestService.getOpenJob(input.number);
    if (!job) throw Errors.notFound("Job");
    return job;
  },
});
