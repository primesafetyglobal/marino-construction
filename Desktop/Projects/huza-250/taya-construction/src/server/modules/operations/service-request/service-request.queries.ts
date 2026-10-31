// SERVICE REQUEST QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getServiceRequestSchema, listServiceRequestsSchema } from "./service-request.schema";
import * as serviceRequestService from "./service-request.service";

export const listServiceRequests = createQuery({
  access: "service-request:read",
  schema: listServiceRequestsSchema,
  handler: ({ input, user }) => serviceRequestService.listServiceRequests(input, { actor: user }),
});

export const getServiceRequest = createQuery({
  access: "service-request:read",
  schema: getServiceRequestSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await serviceRequestService.getServiceRequestDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Request");
    return row;
  },
});
