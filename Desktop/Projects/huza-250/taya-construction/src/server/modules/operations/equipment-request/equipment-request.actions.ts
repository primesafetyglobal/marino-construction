"use server";
// EQUIPMENT REQUEST ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { OPS_PATHS } from "../operations.config";
import {
  createEquipmentRequestSchema,
  setEquipmentRequestHandlerSchema,
  setEquipmentRequestStatusSchema,
  submitEquipmentRequestSchema,
  updateEquipmentRequestSchema,
} from "./equipment-request.schema";
import * as equipmentRequestService from "./equipment-request.service";

const refresh = () => {
  revalidatePath(OPS_PATHS.dashboard, "layout");
};

// PUBLIC: the request sheet for equipment (rent or buy).
// Protection: strict schema with `consent: true`; honeypot `fax` (a fake code,
// nothing saved); Turnstile; 5 per minute per hashed IP; the equipment must be
// public; a stored client is never changed; the reply is { code } only.
export const submitEquipmentRequest = createAction({
  access: "public",
  schema: submitEquipmentRequestSchema,
  handler: async ({ input }) => {
    const result = await equipmentRequestService.submitEquipmentRequest(input, await getRequestMeta());
    refresh();
    return result;
  },
});

export const createEquipmentRequest = createAction({
  access: "equipment-request:create",
  schema: createEquipmentRequestSchema,
  handler: async ({ input }) => {
    const row = await equipmentRequestService.createEquipmentRequest(input);
    refresh();
    return row;
  },
});

export const updateEquipmentRequest = createAction({
  access: "equipment-request:update",
  schema: updateEquipmentRequestSchema,
  handler: async ({ input }) => {
    const row = await equipmentRequestService.updateEquipmentRequest(input);
    refresh();
    return row;
  },
});

export const setEquipmentRequestStatus = createAction({
  access: "equipment-request:update",
  schema: setEquipmentRequestStatusSchema,
  handler: async ({ input }) => {
    const row = await equipmentRequestService.setEquipmentRequestStatus(input);
    refresh();
    revalidatePath("/", "layout");
    return row;
  },
});

export const setEquipmentRequestHandler = createAction({
  access: "equipment-request:update",
  schema: setEquipmentRequestHandlerSchema,
  handler: async ({ input }) => {
    const row = await equipmentRequestService.setEquipmentRequestHandler(input);
    refresh();
    return row;
  },
});
