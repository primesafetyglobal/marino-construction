"use server";
// WORKFORCE REQUEST ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { OPS_PATHS } from "../operations.config";
import {
  createWorkforceRequestSchema,
  publishJobSchema,
  setWorkforceRequestHandlerSchema,
  setWorkforceRequestStatusSchema,
  submitWorkforceRequestSchema,
  updateWorkforceRequestSchema,
  workforceRequestIdSchema,
} from "./workforce-request.schema";
import * as workforceRequestService from "./workforce-request.service";

const refresh = () => {
  revalidatePath(OPS_PATHS.dashboard, "layout");
  revalidatePath(OPS_PATHS.jobs, "layout");
};

// PUBLIC: "Request workers" (Workforce page and request sheet).
// Protection: strict schema with `consent: true`; honeypot `fax` (a fake code,
// nothing saved); Turnstile; 5 per minute per hashed IP; a stored client is
// never changed; the reply is { code } only.
export const submitWorkforceRequest = createAction({
  access: "public",
  schema: submitWorkforceRequestSchema,
  handler: async ({ input }) => {
    const result = await workforceRequestService.submitWorkforceRequest(input, await getRequestMeta());
    refresh();
    return result;
  },
});

export const createWorkforceRequest = createAction({
  access: "workforce-request:create",
  schema: createWorkforceRequestSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.createWorkforceRequest(input);
    refresh();
    return row;
  },
});

export const updateWorkforceRequest = createAction({
  access: "workforce-request:update",
  schema: updateWorkforceRequestSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.updateWorkforceRequest(input);
    refresh();
    return row;
  },
});

export const publishJob = createAction({
  access: "workforce-request:publish",
  schema: publishJobSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.publishJob(input);
    refresh();
    return row;
  },
});

export const unpublishJob = createAction({
  access: "workforce-request:publish",
  schema: workforceRequestIdSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.unpublishJob(input);
    refresh();
    return row;
  },
});

export const setWorkforceRequestStatus = createAction({
  access: "workforce-request:update",
  schema: setWorkforceRequestStatusSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.setWorkforceRequestStatus(input);
    refresh();
    return row;
  },
});

export const setWorkforceRequestHandler = createAction({
  access: "workforce-request:update",
  schema: setWorkforceRequestHandlerSchema,
  handler: async ({ input }) => {
    const row = await workforceRequestService.setWorkforceRequestHandler(input);
    refresh();
    return row;
  },
});
