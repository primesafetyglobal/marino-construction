"use server";
// CATEGORY ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { CATALOG_PATHS } from "../catalog.config";
import { categoryIdSchema, createCategorySchema, updateCategorySchema } from "./category.schema";
import * as categoryService from "./category.service";

const refresh = () => {
  revalidatePath(CATALOG_PATHS.public, "layout");
};

export const createCategory = createAction({
  access: "category:create",
  schema: createCategorySchema,
  handler: async ({ input }) => {
    const category = await categoryService.createCategory(input);
    refresh();
    return category;
  },
});

export const updateCategory = createAction({
  access: "category:update",
  schema: updateCategorySchema,
  handler: async ({ input }) => {
    const category = await categoryService.updateCategory(input);
    refresh();
    return category;
  },
});

export const deleteCategory = createAction({
  access: "category:delete",
  schema: categoryIdSchema,
  handler: async ({ input }) => {
    const result = await categoryService.deleteCategory(input);
    refresh();
    return result;
  },
});
