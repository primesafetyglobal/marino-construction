"use server";
// EQUIPMENT ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { CATALOG_PATHS } from "../catalog.config";
import {
  createEquipmentSchema,
  equipmentIdSchema,
  publicUploadTicketSchema,
  setEquipmentStatusSchema,
  submitEquipmentSchema,
  updateEquipmentSchema,
  uploadTicketSchema,
} from "./equipment.schema";
import * as equipmentService from "./equipment.service";

const refresh = () => {
  revalidatePath(CATALOG_PATHS.public, "layout");
};

export const createEquipment = createAction({
  access: "equipment:create",
  schema: createEquipmentSchema,
  handler: async ({ input }) => {
    const row = await equipmentService.createEquipment(input);
    refresh();
    return row;
  },
});

export const updateEquipment = createAction({
  access: "equipment:update",
  schema: updateEquipmentSchema,
  handler: async ({ input }) => {
    const row = await equipmentService.updateEquipment(input);
    refresh();
    return row;
  },
});

export const setEquipmentStatus = createAction({
  access: "equipment:update",
  schema: setEquipmentStatusSchema,
  handler: async ({ input }) => {
    const row = await equipmentService.setEquipmentStatus(input);
    refresh();
    return row;
  },
});

export const approveEquipment = createAction({
  access: "equipment:approve",
  schema: equipmentIdSchema,
  handler: async ({ input }) => {
    const row = await equipmentService.approveEquipment(input);
    refresh();
    return row;
  },
});

export const deleteEquipment = createAction({
  access: "equipment:delete",
  schema: equipmentIdSchema,
  handler: async ({ input }) => {
    const row = await equipmentService.deleteEquipment(input);
    refresh();
    return row;
  },
});

// PUBLIC: the "Rent out / sell your equipment" form.
// Protection: strict schema with `consent: true`; honeypot `fax` (fake success,
// nothing saved); Turnstile; 5 per minute per hashed IP; saved PENDING and
// hidden; the reply is { received: true } only.
export const submitEquipment = createAction({
  access: "public",
  schema: submitEquipmentSchema,
  handler: async ({ input }) => equipmentService.submitEquipment(input, await getRequestMeta()),
});

// Staff image uploads for every catalog form.
export const createCatalogUploadTicket = createAction({
  access: ["equipment:create", "equipment:update", "product:create", "product:update", "service:create", "service:update", "training:create", "training:update", "category:create", "category:update"],
  schema: uploadTicketSchema,
  handler: async ({ input }) => equipmentService.createCatalogUploadTicket(input),
});

// PUBLIC: photo upload ticket for the "list your equipment" form.
// Protection: strict schema; images only (type and size from catalog.config);
// 20 per minute per hashed IP; the reply holds a signed URL and a signed
// token, never a storage key.
export const createEquipmentUploadTicket = createAction({
  access: "public",
  schema: publicUploadTicketSchema,
  handler: async ({ input }) => equipmentService.createPublicEquipmentUploadTicket(input, await getRequestMeta()),
});
