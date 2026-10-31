// SERVICE QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import {
  featuredServicesSchema,
  getServiceBySlugSchema,
  getServiceSchema,
  listServicesSchema,
  servicesByDivisionSchema,
} from "./service.schema";
import * as serviceService from "./service.service";

// PUBLIC: active services, public select (CAT-R10); staff with service:read see all.
export const listServices = createQuery({
  access: "public",
  schema: listServicesSchema,
  handler: ({ input, user }) => serviceService.listServices(input, { actor: user }),
});

// PUBLIC: one service; inactive ones answer NOT_FOUND to visitors.
export const getService = createQuery({
  access: "public",
  schema: getServiceSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await serviceService.getServiceDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Service");
    return row;
  },
});

// PUBLIC: the service page, with the other services of its division.
export const getServiceBySlug = createQuery({
  access: "public",
  schema: getServiceBySlugSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await serviceService.getServiceBySlug(input.slug);
    if (!row) throw Errors.notFound("Service");
    const siblings = await serviceService.listServicesByDivision(row.category.division);
    return { item: row, others: siblings.filter((s) => s.id !== row.id) };
  },
});

// PUBLIC: division pages and the header mega-menu.
export const getServicesByDivision = createQuery({
  access: "public",
  schema: servicesByDivisionSchema,
  handler: ({ input }) => serviceService.listServicesByDivision(input.division),
});

// PUBLIC: home page "Featured inspections & testing".
export const getFeaturedServices = createQuery({
  access: "public",
  schema: featuredServicesSchema,
  handler: ({ input }) => serviceService.listFeaturedServices(input.division, input.limit),
});

export const listServicesAdmin = createQuery({
  access: "service:read",
  schema: listServicesSchema,
  handler: ({ input }) => serviceService.listServicesAdmin(input),
});

export const getServiceAdmin = createQuery({
  access: "service:read",
  schema: getServiceSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await serviceService.getServiceAdmin(input.id);
    if (!row) throw Errors.notFound("Service");
    return row;
  },
});
