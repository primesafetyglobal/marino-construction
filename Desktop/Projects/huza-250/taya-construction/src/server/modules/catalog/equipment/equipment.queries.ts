// EQUIPMENT QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { noParams } from "@/server/validation/pagination";
import {
  featuredSchema,
  getEquipmentBySlugSchema,
  getEquipmentSchema,
  listEquipmentSchema,
} from "./equipment.schema";
import * as equipmentService from "./equipment.service";

// PUBLIC: AVAILABLE / RENTED only, public select (CAT-R6). Staff holding
// equipment:read get every status and the admin select (owner).
export const listEquipment = createQuery({
  access: "public",
  schema: listEquipmentSchema,
  handler: ({ input, user }) => equipmentService.listEquipment(input, { actor: user }),
});

// PUBLIC: same rule for one record; hidden records answer NOT_FOUND.
export const getEquipment = createQuery({
  access: "public",
  schema: getEquipmentSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await equipmentService.getEquipmentDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Equipment");
    return row;
  },
});

// PUBLIC: the equipment detail page.
export const getEquipmentBySlug = createQuery({
  access: "public",
  schema: getEquipmentBySlugSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await equipmentService.getEquipmentBySlug(input.slug);
    if (!row) throw Errors.notFound("Equipment");
    return { item: row, related: await equipmentService.listRelatedEquipment(row.category.id, row.id) };
  },
});

// PUBLIC: home page scroller.
export const getFeaturedEquipment = createQuery({
  access: "public",
  schema: featuredSchema,
  handler: ({ input }) => equipmentService.listFeaturedEquipment(input.limit),
});

// Admin pages: always the admin select.
export const listEquipmentAdmin = createQuery({
  access: "equipment:read",
  schema: listEquipmentSchema,
  handler: ({ input }) => equipmentService.listEquipmentAdmin(input),
});

export const getEquipmentAdmin = createQuery({
  access: "equipment:read",
  schema: getEquipmentSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await equipmentService.getEquipmentAdmin(input.id);
    if (!row) throw Errors.notFound("Equipment");
    return row;
  },
});

// Dashboard counter: submissions waiting for approval.
export const getPendingEquipmentCount = createQuery({
  access: "equipment:read",
  schema: noParams,
  handler: () => equipmentService.countPendingEquipment(),
});
