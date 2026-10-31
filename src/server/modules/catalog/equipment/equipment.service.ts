// EQUIPMENT SERVICE: machines and vehicles for rent and/or sale.
//
// Rules:
// - CAT-R1  slug unique
// - CAT-R4  the category must be an EQUIPMENT category
// - CAT-R5  rent and/or sale; a rent price needs a unit; specs ≤ 20 rows
// - CAT-R6  only AVAILABLE and RENTED equipment is public; the owner never is
// - CAT-R7  public submissions are PENDING, linked to a vendor found or created
//           by contact (never overwritten); approving needs an APPROVED owner
// - CAT-R8  equipment with requests cannot be deleted (set INACTIVE)
// - CAT-R12 status moves only through setEquipmentStatus / approveEquipment /
//           the shared functions used by operations; RENTED only from a rental
// - CAT-R13 public writes: honeypot fake success, Turnstile, rate limit, consent
//
// D-2: imports parties/vendor findOrCreateVendor (submitEquipment only).

import "server-only";
import { Errors } from "@/server/core/errors";
import { appUrl, brandedEmail, sendMail } from "@/server/integrations/mailer";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { findOrCreateVendor } from "@/server/modules/parties/vendor/vendor.service";
import { CATALOG_CONFIG } from "../catalog.config";
import { createUploadTicket, PUBLIC_EQUIPMENT_FOLDER, resolveImages } from "../catalog.files";
import type { UploadTicket } from "../catalog.select";
import { checkRateLimit } from "@/server/validation/rate-limit";
import type { Spec } from "../catalog.select";
import { uniqueSlug } from "../catalog.slug";
import { assertCategoryType } from "../category/category.service";
import {
  specsSchema,
  type CreateEquipmentData,
  type EquipmentIdData,
  type ListEquipmentData,
  type SetEquipmentStatusData,
  type SubmitEquipmentData,
  type UpdateEquipmentData,
  type UploadTicketData,
} from "./equipment.schema";
import {
  equipmentAdminSelect,
  equipmentPublicSelect,
  equipmentRefSelect,
  type EquipmentAdmin,
  type EquipmentList,
  type EquipmentOne,
  type EquipmentPublic,
  type EquipmentRef,
} from "./equipment.select";

type Actor = { actor: SessionUser | null };
type EquipmentStatus = EquipmentPublic["status"];

// CAT-R6: the one definition of "public equipment".
const PUBLIC_STATUSES: EquipmentStatus[] = [...CATALOG_CONFIG.publicEquipmentStatuses];
const publicWhere = { status: { in: PUBLIC_STATUSES } } satisfies Prisma.EquipmentWhereInput;

const ORDER = [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

const readSpecs = (value: unknown): Spec[] => {
  const parsed = specsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

// CAT-R6: public results are built field by field.
function toPublic(row: Prisma.EquipmentGetPayload<{ select: typeof equipmentPublicSelect }>): EquipmentPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    images: row.images,
    specs: readSpecs(row.specs),
    location: row.location,
    forRent: row.forRent,
    rentPrice: row.rentPrice,
    rentUnit: row.rentUnit,
    forSale: row.forSale,
    salePrice: row.salePrice,
    status: row.status,
    isFeatured: row.isFeatured,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
  };
}

const toAdmin = (row: Prisma.EquipmentGetPayload<{ select: typeof equipmentAdminSelect }>): EquipmentAdmin => ({
  ...row,
  specs: readSpecs(row.specs),
});

function filters(query: ListEquipmentData, staff: boolean): Prisma.EquipmentWhereInput {
  const and: Prisma.EquipmentWhereInput[] = [];
  if (!staff) and.push(publicWhere);
  else if (query.status) and.push({ status: query.status });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { location: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.category) and.push({ category: { is: { OR: [{ slug: query.category }, ...(isUuid(query.category) ? [{ id: query.category }] : [])] } } });
  if (query.mode === "rent") and.push({ forRent: true });
  if (query.mode === "sale") and.push({ forSale: true });
  if (query.location) and.push({ location: { contains: query.location, mode: "insensitive" } });
  if (query.featured) and.push({ isFeatured: true });
  if (staff && query.ownerId) and.push({ ownerId: query.ownerId });
  return and.length ? { AND: and } : {};
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ======================= Reads =======================

// CAT-R6: staff holding equipment:read get the admin select; everyone else the public one.
export async function listEquipment(query: ListEquipmentData, ctx: Actor): Promise<EquipmentList> {
  const staff = hasPermission(ctx.actor, "equipment:read") && query.view !== "public";
  if (staff) return { view: "admin", ...(await listEquipmentAdmin(query)) };
  const rows = await db.equipment.findMany({
    where: filters(query, false),
    orderBy: ORDER,
    select: equipmentPublicSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { view: "public", items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

// Admin list: PENDING submissions first, so staff see them at the top.
export async function listEquipmentAdmin(query: ListEquipmentData) {
  const rows = await db.equipment.findMany({
    where: filters(query, true),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    select: equipmentAdminSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map(toAdmin), nextCursor: page.nextCursor };
}

export async function getEquipmentDetail(id: string, ctx: Actor): Promise<EquipmentOne | null> {
  if (hasPermission(ctx.actor, "equipment:read")) {
    const row = await db.equipment.findUnique({ where: { id }, select: equipmentAdminSelect });
    return row ? { view: "admin", ...toAdmin(row) } : null;
  }
  const row = await db.equipment.findFirst({ where: { id, ...publicWhere }, select: equipmentPublicSelect });
  return row ? { view: "public", ...toPublic(row) } : null;
}

export async function getEquipmentAdmin(id: string): Promise<EquipmentAdmin | null> {
  const row = await db.equipment.findUnique({ where: { id }, select: equipmentAdminSelect });
  return row ? toAdmin(row) : null;
}

// CAT-R6: the public detail page; a hidden item answers null (NOT_FOUND).
export async function getEquipmentBySlug(slug: string): Promise<EquipmentPublic | null> {
  const row = await db.equipment.findFirst({ where: { slug, ...publicWhere }, select: equipmentPublicSelect });
  return row ? toPublic(row) : null;
}

export async function listFeaturedEquipment(limit: number): Promise<EquipmentPublic[]> {
  const rows = await db.equipment.findMany({
    where: { ...publicWhere, isFeatured: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: equipmentPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

export async function listRelatedEquipment(categoryId: string, exceptId: string, limit = 4): Promise<EquipmentPublic[]> {
  const rows = await db.equipment.findMany({
    where: { ...publicWhere, categoryId, id: { not: exceptId } },
    orderBy: ORDER,
    select: equipmentPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

export function countPendingEquipment(): Promise<number> {
  return db.equipment.count({ where: { status: "PENDING" } });
}

// ======================= Writes =======================

// CAT-R1, R4, R5. Staff-created equipment is AVAILABLE straight away.
export async function createEquipment(data: CreateEquipmentData): Promise<EquipmentRef> {
  const images = await resolveImages(data.images, "equipment", true);
  return db.$transaction(async (tx) => {
    await assertCategoryType(data.categoryId, "EQUIPMENT", tx);
    if (data.ownerId) await assertOwnerExists(data.ownerId, tx);
    const slug = await uniqueSlug("equipment", { wanted: data.slug, from: data.name }, tx);
    return tx.equipment.create({
      data: {
        categoryId: data.categoryId,
        ownerId: data.ownerId ?? null,
        name: data.name,
        slug,
        description: data.description,
        images,
        specs: data.specs,
        location: data.location,
        forRent: data.forRent,
        rentPrice: data.forRent ? (data.rentPrice ?? null) : null,
        rentUnit: data.forRent ? (data.rentUnit ?? null) : null,
        forSale: data.forSale,
        salePrice: data.forSale ? (data.salePrice ?? null) : null,
        status: "AVAILABLE",
        isFeatured: data.isFeatured,
      },
      select: equipmentRefSelect,
    });
  });
}

// CAT-R1, R4, R5 (checked again on the merged values), R12 (no status here).
export async function updateEquipment(data: UpdateEquipmentData): Promise<EquipmentRef> {
  const images = data.images ? await resolveImages(data.images, "equipment", true) : undefined;
  return db.$transaction(async (tx) => {
    const current = await tx.equipment.findUnique({
      where: { id: data.id },
      select: { id: true, forRent: true, forSale: true, rentPrice: true, rentUnit: true },
    });
    if (!current) throw Errors.notFound("Equipment");
    if (data.categoryId) await assertCategoryType(data.categoryId, "EQUIPMENT", tx);
    if (data.ownerId) await assertOwnerExists(data.ownerId, tx);
    const forRent = data.forRent ?? current.forRent;
    const forSale = data.forSale ?? current.forSale;
    const rentPrice = data.rentPrice !== undefined ? data.rentPrice : current.rentPrice;
    const rentUnit = data.rentUnit !== undefined ? data.rentUnit : current.rentUnit;
    assertPricing({ forRent, forSale, rentPrice, rentUnit });
    const slug = data.slug ? await uniqueSlug("equipment", { wanted: data.slug, from: data.slug, exceptId: data.id }, tx) : undefined;
    return tx.equipment.update({
      where: { id: data.id },
      data: {
        categoryId: data.categoryId,
        ownerId: data.ownerId,
        name: data.name,
        slug,
        description: data.description,
        images,
        specs: data.specs,
        location: data.location,
        forRent: data.forRent,
        rentPrice: data.rentPrice,
        rentUnit: data.rentUnit,
        forSale: data.forSale,
        salePrice: data.salePrice,
        isFeatured: data.isFeatured,
      },
      select: equipmentRefSelect,
    });
  });
}

// CAT-R12: manual moves. RENTED and PENDING are never set by hand; a rented
// machine is released by completing its rental.
export async function setEquipmentStatus(data: SetEquipmentStatusData): Promise<EquipmentRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.equipment.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Equipment");
    if (current.status === data.status) throw Errors.conflict(`This equipment is already ${data.status.toLowerCase()}.`);
    if (current.status === "PENDING") throw Errors.conflict("Approve this submission first.");
    if (current.status === "RENTED") throw Errors.conflict("This equipment is rented. Complete or cancel the rental first.");
    const { count } = await tx.equipment.updateMany({
      where: { id: data.id, status: current.status },
      data: { status: data.status },
    });
    if (count === 0) throw Errors.conflict("This equipment was changed by someone else. Reload and try again.");
    return tx.equipment.findUniqueOrThrow({ where: { id: data.id }, select: equipmentRefSelect });
  });
}

// CAT-R7: PENDING → AVAILABLE. A vendor-owned item needs an APPROVED owner.
export async function approveEquipment({ id }: EquipmentIdData): Promise<EquipmentRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.equipment.findUnique({
      where: { id },
      select: { status: true, owner: { select: { status: true } } },
    });
    if (!current) throw Errors.notFound("Equipment");
    if (current.status !== "PENDING") throw Errors.conflict("Only pending submissions can be approved.");
    if (current.owner && current.owner.status !== "APPROVED") {
      throw Errors.conflict("Approve the owner (vendor) first, then publish the equipment.");
    }
    const { count } = await tx.equipment.updateMany({ where: { id, status: "PENDING" }, data: { status: "AVAILABLE" } });
    if (count === 0) throw Errors.conflict("This equipment was changed by someone else. Reload and try again.");
    return tx.equipment.findUniqueOrThrow({ where: { id }, select: equipmentRefSelect });
  });
}

// CAT-R8.
export async function deleteEquipment({ id }: EquipmentIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.equipment.findUnique({ where: { id }, select: { _count: { select: { requests: true } } } });
    if (!current) throw Errors.notFound("Equipment");
    if (current._count.requests > 0) throw Errors.conflict("This equipment has requests. Set it to Inactive instead.");
    await tx.equipment.delete({ where: { id } });
    return { id };
  });
}

// PUBLIC (CAT-R7, CAT-R13). Returns only { received: true }.
export async function submitEquipment(data: SubmitEquipmentData, meta: RequestMeta): Promise<{ received: true }> {
  if (isBot(data.fax)) return { received: true };
  await guardPublicWrite({ scope: "submit-equipment", meta, turnstileToken: data.turnstileToken });
  const images = await resolveImages(data.images, "equipment", false);

  const created = await db.$transaction(async (tx) => {
    await assertCategoryType(data.categoryId, "EQUIPMENT", tx);
    const vendor = await findOrCreateVendor(
      {
        returning: data.returning,
        phone: data.phone,
        email: data.email,
        name: data.contactName,
        entityType: data.entityType,
        companyName: data.companyName,
        tin: data.tin,
        district: data.district,
        type: "EQUIPMENT_OWNER",
        offerings: `Equipment: ${data.name}`,
      },
      tx,
    );
    const slug = await uniqueSlug("equipment", { from: data.name }, tx);
    return tx.equipment.create({
      data: {
        categoryId: data.categoryId,
        ownerId: vendor.id,
        name: data.name,
        slug,
        description: data.description,
        images,
        specs: data.specs,
        location: data.location,
        forRent: data.forRent,
        rentPrice: data.forRent ? (data.rentPrice ?? null) : null,
        rentUnit: data.forRent ? (data.rentUnit ?? null) : null,
        forSale: data.forSale,
        salePrice: data.forSale ? (data.salePrice ?? null) : null,
        status: "PENDING",
      },
      select: { id: true, name: true },
    });
  });

  // After commit: a failed email never undoes the submission.
  await notifyStaff(created).catch((err) => console.error("[catalog] equipment submission email failed", err));
  return { received: true };
}

// Staff upload ticket for any catalog image.
export function createCatalogUploadTicket(data: UploadTicketData): Promise<UploadTicket> {
  return createUploadTicket(data);
}

// PUBLIC: an equipment photo ticket for the "list your equipment" form.
// 20 tickets per minute per hashed IP; images only, size from catalog.config.
export function createPublicEquipmentUploadTicket(
  data: { mimeType: string; sizeBytes: number },
  meta: RequestMeta,
): Promise<UploadTicket> {
  checkRateLimit({ scope: "upload-equipment", ip: meta.ip, limit: 20, windowMs: 60_000 });
  return createUploadTicket({ kind: "equipment", ...data }, { folder: PUBLIC_EQUIPMENT_FOLDER });
}

// ======================= Shared with other modules (D-2) =======================

// Operations: one ACTIVE rental at a time (OPS-R7). Locks the equipment row so
// two activations of the same machine take turns.
export async function lockEquipmentForRental(equipmentId: string, client: DbClient) {
  await client.$executeRaw`SELECT 1 FROM "Equipment" WHERE "id" = ${equipmentId} FOR UPDATE`;
  const row = await client.equipment.findUnique({ where: { id: equipmentId }, select: { id: true, status: true, forRent: true } });
  if (!row) throw Errors.notFound("Equipment");
  return row;
}

// Operations: status side effects of requests (OPS-R6), in the caller's transaction.
export async function setEquipmentStatusShared(equipmentId: string, status: EquipmentStatus, client: DbClient): Promise<void> {
  await client.equipment.update({ where: { id: equipmentId }, data: { status } });
}

// Operations: a requested item must exist; public requests need a public one (OPS-R10).
export async function assertPublicEquipment(id: string, opts: { publicOnly: boolean }, client: DbClient) {
  const row = await client.equipment.findFirst({
    where: { id, ...(opts.publicOnly ? publicWhere : {}) },
    select: { id: true, name: true, forRent: true, forSale: true },
  });
  if (!row) throw Errors.invalid("This equipment is not available.", { equipmentId: ["Not available."] });
  return row;
}

// ======================= Helpers (not exported) =======================

// CAT-R5, checked on the values the row will have after a partial update.
function assertPricing(d: { forRent: boolean; forSale: boolean; rentPrice: number | null; rentUnit: string | null }) {
  if (!d.forRent && !d.forSale) throw Errors.invalid("Choose rent, sale or both.", { forRent: ["Choose rent, sale or both."] });
  if (d.forRent && d.rentPrice && !d.rentUnit) throw Errors.invalid("Choose a rent unit.", { rentUnit: ["Choose a rent unit."] });
}

async function assertOwnerExists(ownerId: string, client: DbClient) {
  // D-1: reads parties.Vendor through the relation kept by the locked schema.
  const owner = await client.vendor.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) throw Errors.invalid("Choose an existing vendor.", { ownerId: ["Vendor not found."] });
}

async function notifyStaff(item: { id: string; name: string }) {
  const to = process.env.STAFF_NOTIFY_EMAIL;
  if (!to) return;
  const mail = brandedEmail({
    title: "New equipment submission",
    lines: [`"${item.name}" was submitted through the website and is waiting for review.`],
    button: { label: "Open in dashboard", url: appUrl(`/admin/catalog/equipment/${item.id}`) },
  });
  await sendMail({ to, subject: `New equipment submission: ${item.name}`, ...mail });
}
