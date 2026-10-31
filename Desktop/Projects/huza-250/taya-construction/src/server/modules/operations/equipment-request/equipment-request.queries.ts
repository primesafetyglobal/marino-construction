// EQUIPMENT REQUEST QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getEquipmentRequestSchema, listEquipmentRequestsSchema, rentHistorySchema } from "./equipment-request.schema";
import * as equipmentRequestService from "./equipment-request.service";

export const listEquipmentRequests = createQuery({
  access: "equipment-request:read",
  schema: listEquipmentRequestsSchema,
  handler: ({ input, user }) => equipmentRequestService.listEquipmentRequests(input, { actor: user }),
});

export const getEquipmentRequest = createQuery({
  access: "equipment-request:read",
  schema: getEquipmentRequestSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await equipmentRequestService.getEquipmentRequestDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Request");
    return row;
  },
});

// The equipment page in admin shows its rentals.
export const getEquipmentRentHistory = createQuery({
  access: ["equipment-request:read", "equipment:read"],
  schema: rentHistorySchema,
  handler: ({ input }) => equipmentRequestService.listRentHistory(input.equipmentId),
});
