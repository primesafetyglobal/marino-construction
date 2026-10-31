// PRODUCT QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { featuredProductsSchema, getProductBySlugSchema, getProductSchema, listProductsSchema } from "./product.schema";
import * as productService from "./product.service";

// PUBLIC: available products, public select (CAT-R9); staff with product:read get the admin select.
export const listProducts = createQuery({
  access: "public",
  schema: listProductsSchema,
  handler: ({ input, user }) => productService.listProducts(input, { actor: user }),
});

// PUBLIC: one product; hidden ones answer NOT_FOUND.
export const getProduct = createQuery({
  access: "public",
  schema: getProductSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await productService.getProductDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Product");
    return row;
  },
});

// PUBLIC: the product detail page.
export const getProductBySlug = createQuery({
  access: "public",
  schema: getProductBySlugSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await productService.getProductBySlug(input.slug);
    if (!row) throw Errors.notFound("Product");
    return { item: row, related: await productService.listRelatedProducts(row.category.id, row.id) };
  },
});

// PUBLIC: home page.
export const getFeaturedProducts = createQuery({
  access: "public",
  schema: featuredProductsSchema,
  handler: ({ input }) => productService.listFeaturedProducts(input.limit),
});

// PUBLIC: Paint Rwanda page.
export const getPaintProducts = createQuery({
  access: "public",
  schema: featuredProductsSchema,
  handler: ({ input }) => productService.listPaintProducts(input.limit),
});

export const listProductsAdmin = createQuery({
  access: "product:read",
  schema: listProductsSchema,
  handler: ({ input }) => productService.listProductsAdmin(input),
});

export const getProductAdmin = createQuery({
  access: "product:read",
  schema: getProductSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await productService.getProductAdmin(input.id);
    if (!row) throw Errors.notFound("Product");
    return row;
  },
});
