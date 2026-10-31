// PRODUCT SERVICE: construction materials and paint for supply.
//
// Rules:
// - CAT-R1 slug unique
// - CAT-R4 the category must be a PRODUCT category
// - CAT-R9 only available products are public; the supplier never is; paint
//          products are the products of the "paints-finishes" category
// Delete is allowed: orders keep their text and lose the product link (SetNull).

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { CATALOG_CONFIG } from "../catalog.config";
import { resolveImages } from "../catalog.files";
import { uniqueSlug } from "../catalog.slug";
import { assertCategoryType } from "../category/category.service";
import type { CreateProductData, ListProductsData, ProductIdData, UpdateProductData } from "./product.schema";
import {
  productAdminSelect,
  productPublicSelect,
  productRefSelect,
  type ProductAdmin,
  type ProductList,
  type ProductOne,
  type ProductPublic,
  type ProductRef,
} from "./product.select";

type Actor = { actor: SessionUser | null };

// CAT-R9: the one definition of "public product".
const publicWhere = { isAvailable: true } satisfies Prisma.ProductWhereInput;
const ORDER = [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

// CAT-R9: public results are built field by field.
const toPublic = (row: ProductPublic): ProductPublic => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  images: row.images,
  brand: row.brand,
  price: row.price,
  unit: row.unit,
  isFeatured: row.isFeatured,
  category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
});

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function filters(query: ListProductsData, staff: boolean): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (!staff) and.push(publicWhere);
  else if (query.available !== undefined) and.push({ isAvailable: query.available });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.category) and.push({ category: { is: { OR: [{ slug: query.category }, ...(isUuid(query.category) ? [{ id: query.category }] : [])] } } });
  if (query.featured) and.push({ isFeatured: true });
  return and.length ? { AND: and } : {};
}

// ======================= Reads =======================

export async function listProducts(query: ListProductsData, ctx: Actor): Promise<ProductList> {
  if (hasPermission(ctx.actor, "product:read") && query.view !== "public") return { view: "admin", ...(await listProductsAdmin(query)) };
  const rows = await db.product.findMany({ where: filters(query, false), orderBy: ORDER, select: productPublicSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  return { view: "public", items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

export async function listProductsAdmin(query: ListProductsData) {
  const rows = await db.product.findMany({ where: filters(query, true), orderBy: ORDER, select: productAdminSelect, ...pageArgs(query) });
  return toPage(rows, query.limit);
}

export async function getProductDetail(id: string, ctx: Actor): Promise<ProductOne | null> {
  if (hasPermission(ctx.actor, "product:read")) {
    const row = await db.product.findUnique({ where: { id }, select: productAdminSelect });
    return row ? { view: "admin", ...row } : null;
  }
  const row = await db.product.findFirst({ where: { id, ...publicWhere }, select: productPublicSelect });
  return row ? { view: "public", ...toPublic(row) } : null;
}

export function getProductAdmin(id: string): Promise<ProductAdmin | null> {
  return db.product.findUnique({ where: { id }, select: productAdminSelect });
}

export async function getProductBySlug(slug: string): Promise<ProductPublic | null> {
  const row = await db.product.findFirst({ where: { slug, ...publicWhere }, select: productPublicSelect });
  return row ? toPublic(row) : null;
}

export async function listFeaturedProducts(limit: number): Promise<ProductPublic[]> {
  const rows = await db.product.findMany({
    where: { ...publicWhere, isFeatured: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: productPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

// CAT-R9: paint products also show on the Paint Rwanda page.
export async function listPaintProducts(limit: number): Promise<ProductPublic[]> {
  const rows = await db.product.findMany({
    where: { ...publicWhere, category: { is: { slug: CATALOG_CONFIG.paintCategorySlug } } },
    orderBy: ORDER,
    select: productPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

export async function listRelatedProducts(categoryId: string, exceptId: string, limit = 4): Promise<ProductPublic[]> {
  const rows = await db.product.findMany({
    where: { ...publicWhere, categoryId, id: { not: exceptId } },
    orderBy: ORDER,
    select: productPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

// ======================= Writes =======================

// CAT-R1, R4.
export async function createProduct(data: CreateProductData): Promise<ProductRef> {
  const images = await resolveImages(data.images, "product", true);
  return db.$transaction(async (tx) => {
    await assertCategoryType(data.categoryId, "PRODUCT", tx);
    if (data.supplierId) await assertSupplierExists(data.supplierId, tx);
    const slug = await uniqueSlug("product", { wanted: data.slug, from: data.name }, tx);
    return tx.product.create({
      data: {
        categoryId: data.categoryId,
        supplierId: data.supplierId ?? null,
        name: data.name,
        slug,
        description: data.description,
        images,
        brand: data.brand,
        price: data.price ?? null,
        unit: data.unit,
        isAvailable: data.isAvailable,
        isFeatured: data.isFeatured,
      },
      select: productRefSelect,
    });
  });
}

// CAT-R1, R4.
export async function updateProduct(data: UpdateProductData): Promise<ProductRef> {
  const images = data.images ? await resolveImages(data.images, "product", true) : undefined;
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!current) throw Errors.notFound("Product");
    if (data.categoryId) await assertCategoryType(data.categoryId, "PRODUCT", tx);
    if (data.supplierId) await assertSupplierExists(data.supplierId, tx);
    const slug = data.slug ? await uniqueSlug("product", { wanted: data.slug, from: data.slug, exceptId: data.id }, tx) : undefined;
    return tx.product.update({
      where: { id: data.id },
      data: {
        categoryId: data.categoryId,
        supplierId: data.supplierId,
        name: data.name,
        slug,
        description: data.description,
        images,
        brand: data.brand,
        price: data.price,
        unit: data.unit,
        isAvailable: data.isAvailable,
        isFeatured: data.isFeatured,
      },
      select: productRefSelect,
    });
  });
}

export async function deleteProduct({ id }: ProductIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw Errors.notFound("Product");
    await tx.product.delete({ where: { id } });
    return { id };
  });
}

// ======================= Shared with other modules (D-2) =======================

// Operations: a requested product must exist; public orders need an available one (OPS-R10).
export async function assertPublicProduct(id: string, opts: { publicOnly: boolean }, client: DbClient) {
  const row = await client.product.findFirst({
    where: { id, ...(opts.publicOnly ? publicWhere : {}) },
    select: { id: true, name: true },
  });
  if (!row) throw Errors.invalid("This product is not available.", { productId: ["Not available."] });
  return row;
}

// ======================= Helpers (not exported) =======================

async function assertSupplierExists(supplierId: string, client: DbClient) {
  // D-1: reads parties.Vendor through the relation kept by the locked schema.
  const vendor = await client.vendor.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!vendor) throw Errors.invalid("Choose an existing vendor.", { supplierId: ["Vendor not found."] });
}
