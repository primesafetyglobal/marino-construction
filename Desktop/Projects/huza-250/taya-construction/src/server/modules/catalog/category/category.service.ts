// CATEGORY SERVICE: groups of equipment, products and services, each linked to a division.
//
// Rules:
// - CAT-R1 slug unique (generated from the name when blank)
// - CAT-R2 the type cannot change once items are attached
// - CAT-R3 delete is blocked while the category has equipment, products or services
// - CAT-R4 an item's category must have the matching type (assertCategoryType,
//          shared with the other catalog services)
//
// Categories are a small fixed set: lists are capped at 500 rows, no cursor.

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient } from "@/server/validation/db";
import { uniqueSlug } from "../catalog.slug";
import { resolveImage } from "../catalog.files";
import type { CategoryIdData, CreateCategoryData, ListCategoriesData, UpdateCategoryData } from "./category.schema";
import {
  categoryAdminSelect,
  categoryPublicSelect,
  categoryRefSelect,
  type CategoryAdmin,
  type CategoryList,
  type CategoryPublic,
  type CategoryRef,
} from "./category.select";

type Actor = { actor: SessionUser | null };
type CategoryType = "EQUIPMENT" | "PRODUCT" | "SERVICE";
type Division = CategoryPublic["division"];

const ORDER = [{ order: "asc" as const }, { name: "asc" as const }, { id: "asc" as const }];

// ======================= Reads =======================

export async function listCategories(query: ListCategoriesData, ctx: Actor): Promise<CategoryList> {
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.division ? { division: query.division } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
  };
  if (hasPermission(ctx.actor, "category:read")) {
    const items = await db.category.findMany({ where, orderBy: ORDER, select: categoryAdminSelect, take: 500 });
    return { view: "admin", items };
  }
  const items = await db.category.findMany({ where, orderBy: ORDER, select: categoryPublicSelect, take: 500 });
  return { view: "public", items };
}

export function getCategoryDetail(id: string): Promise<CategoryAdmin | null> {
  return db.category.findUnique({ where: { id }, select: categoryAdminSelect });
}

export function getCategoryPublic(id: string): Promise<CategoryPublic | null> {
  return db.category.findUnique({ where: { id }, select: categoryPublicSelect });
}

export function getCategoryBySlug(slug: string): Promise<CategoryPublic | null> {
  return db.category.findUnique({ where: { slug }, select: categoryPublicSelect });
}

export function listCategoriesByType(type: CategoryType): Promise<CategoryPublic[]> {
  return db.category.findMany({ where: { type }, orderBy: ORDER, select: categoryPublicSelect, take: 500 });
}

export function listCategoriesByDivision(division: Division): Promise<CategoryPublic[]> {
  return db.category.findMany({ where: { division }, orderBy: ORDER, select: categoryPublicSelect, take: 500 });
}

// ======================= Writes =======================

// CAT-R1.
export async function createCategory(data: CreateCategoryData): Promise<CategoryRef> {
  const image = data.image ? await resolveImage(data.image, "category", true) : null;
  return db.$transaction(async (tx) => {
    const slug = await uniqueSlug("category", { wanted: data.slug, from: data.name }, tx);
    return tx.category.create({
      data: {
        name: data.name,
        slug,
        type: data.type,
        division: data.division,
        description: data.description,
        image,
        order: data.order,
      },
      select: categoryRefSelect,
    });
  });
}

// CAT-R1, CAT-R2.
export async function updateCategory(data: UpdateCategoryData): Promise<CategoryRef> {
  const image = data.image ? await resolveImage(data.image, "category", true) : data.image;
  return db.$transaction(async (tx) => {
    const current = await tx.category.findUnique({
      where: { id: data.id },
      select: { id: true, type: true, _count: { select: { equipment: true, products: true, services: true } } },
    });
    if (!current) throw Errors.notFound("Category");
    if (data.type && data.type !== current.type) {
      const used = current._count.equipment + current._count.products + current._count.services;
      if (used > 0) {
        throw Errors.conflict("The type cannot change while items are in this category.", {
          type: ["Move or remove its items first."],
        });
      }
    }
    const slug = data.slug ? await uniqueSlug("category", { wanted: data.slug, from: data.slug, exceptId: data.id }, tx) : undefined;
    return tx.category.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug,
        type: data.type,
        division: data.division,
        description: data.description,
        image,
        order: data.order,
      },
      select: categoryRefSelect,
    });
  });
}

// CAT-R3.
export async function deleteCategory({ id }: CategoryIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.category.findUnique({
      where: { id },
      select: { _count: { select: { equipment: true, products: true, services: true } } },
    });
    if (!current) throw Errors.notFound("Category");
    const used = current._count.equipment + current._count.products + current._count.services;
    if (used > 0) throw Errors.conflict(`This category has ${used} item${used === 1 ? "" : "s"}. Move or remove them first.`);
    await tx.category.delete({ where: { id } });
    return { id };
  });
}

// ======================= Shared with other services (catalog only) =======================

// CAT-R4: the category exists and has the expected type.
export async function assertCategoryType(categoryId: string, type: CategoryType, client: DbClient) {
  const category = await client.category.findUnique({ where: { id: categoryId }, select: { id: true, type: true, division: true } });
  if (!category) throw Errors.invalid("Choose a category.", { categoryId: ["Category not found."] });
  if (category.type !== type) {
    throw Errors.invalid("This category is for another kind of item.", { categoryId: [`Choose a ${type.toLowerCase()} category.`] });
  }
  return category;
}
