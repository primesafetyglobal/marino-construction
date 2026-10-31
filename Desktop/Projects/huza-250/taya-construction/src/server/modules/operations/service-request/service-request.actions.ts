"use server";
// SERVICE REQUEST ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { OPS_PATHS } from "../operations.config";
import {
  createServiceRequestSchema,
  reportUploadTicketSchema,
  setServiceRequestHandlerSchema,
  setServiceRequestStatusSchema,
  submitServiceRequestSchema,
  updateServiceRequestSchema,
} from "./service-request.schema";
import * as serviceRequestService from "./service-request.service";

const refresh = () => {
  revalidatePath(OPS_PATHS.dashboard, "layout");
};

// PUBLIC: the request sheet for a service (inspection, waste, engineering,
// painting, equipment services), with the Paint Rwanda installment option.
// Protection: strict schema with `consent: true`; honeypot `fax` (a fake code,
// nothing saved); Turnstile; 5 per minute per hashed IP; the service must be
// active; a stored client is never changed; the reply is { code } only.
export const submitServiceRequest = createAction({
  access: "public",
  schema: submitServiceRequestSchema,
  handler: async ({ input }) => {
    const result = await serviceRequestService.submitServiceRequest(input, await getRequestMeta());
    refresh();
    return result;
  },
});

export const createServiceRequest = createAction({
  access: "service-request:create",
  schema: createServiceRequestSchema,
  handler: async ({ input }) => {
    const row = await serviceRequestService.createServiceRequest(input);
    refresh();
    return row;
  },
});

export const updateServiceRequest = createAction({
  access: "service-request:update",
  schema: updateServiceRequestSchema,
  handler: async ({ input }) => {
    const row = await serviceRequestService.updateServiceRequest(input);
    refresh();
    return row;
  },
});

export const setServiceRequestStatus = createAction({
  access: "service-request:update",
  schema: setServiceRequestStatusSchema,
  handler: async ({ input }) => {
    const row = await serviceRequestService.setServiceRequestStatus(input);
    refresh();
    return row;
  },
});

export const setServiceRequestHandler = createAction({
  access: "service-request:update",
  schema: setServiceRequestHandlerSchema,
  handler: async ({ input }) => {
    const row = await serviceRequestService.setServiceRequestHandler(input);
    refresh();
    return row;
  },
});

export const createDeliveryReportUploadTicket = createAction({
  access: "service-request:update",
  schema: reportUploadTicketSchema,
  handler: async ({ input }) => serviceRequestService.createDeliveryReportUploadTicket(input),
});
