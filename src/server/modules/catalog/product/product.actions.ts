"use server";
// PRODUCT ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { CATALOG_PATHS } from "../catalog.config";
import { createProductSchema, productIdSchema, updateProductSchema } from "./product.schema";
import * as productService from "./product.service";

const refresh = () => {
  revalidatePath(CATALOG_PATHS.public, "layout");
};

export const createProduct = createAction({
  access: "product:create",
  schema: createProductSchema,
  handler: async ({ input }) => {
    const row = await productService.createProduct(input);
    refresh();
    return row;
  },
});

export const updateProduct = createAction({
  access: "product:update",
  schema: updateProductSchema,
  handler: async ({ input }) => {
    const row = await productService.updateProduct(input);
    refresh();
    return row;
  },
});

export const deleteProduct = createAction({
  access: "product:delete",
  schema: productIdSchema,
  handler: async ({ input }) => {
    const row = await productService.deleteProduct(input);
    refresh();
    return row;
  },
});
