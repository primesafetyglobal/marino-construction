// CATEGORY QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { hasPermission } from "@/server/validation/auth";
import {
  getCategoriesByDivisionSchema,
  getCategoriesByTypeSchema,
  getCategoryBySlugSchema,
  getCategorySchema,
  listCategoriesSchema,
} from "./category.schema";
import * as categoryService from "./category.service";

// PUBLIC: categories hold no private data. Staff with category:read get counts.
export const listCategories = createQuery({
  access: "public",
  schema: listCategoriesSchema,
  handler: ({ input, user }) => categoryService.listCategories(input, { actor: user }),
});

// PUBLIC: one category; staff get the admin select.
export const getCategory = createQuery({
  access: "public",
  schema: getCategorySchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = hasPermission(user, "category:read")
      ? await categoryService.getCategoryDetail(input.id)
      : await categoryService.getCategoryPublic(input.id);
    if (!row) throw Errors.notFound("Category");
    return row;
  },
});

// PUBLIC: division pages and filters.
export const getCategoryBySlug = createQuery({
  access: "public",
  schema: getCategoryBySlugSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await categoryService.getCategoryBySlug(input.slug);
    if (!row) throw Errors.notFound("Category");
    return row;
  },
});

// PUBLIC: chips and pickers.
export const getCategoriesByType = createQuery({
  access: "public",
  schema: getCategoriesByTypeSchema,
  handler: ({ input }) => categoryService.listCategoriesByType(input.type),
});

// PUBLIC: division pages and the header mega-menu.
export const getCategoriesByDivision = createQuery({
  access: "public",
  schema: getCategoriesByDivisionSchema,
  handler: ({ input }) => categoryService.listCategoriesByDivision(input.division),
});
