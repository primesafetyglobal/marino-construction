// VENDOR SERVICE: equipment owners, suppliers, garages, technicians,
// contractors and recyclers; some are Marino partners.
//
// Rules:
// - PTY-R1  phone / email normalised; at least one; unique
// - PTY-R2  COMPANY needs a company name; TIN 9 digits, unique
// - PTY-R3  findOrCreateVendor / submitVendor: by phone, then email; never overwrites
// - PTY-R5  new vendors PENDING; only APPROVED vendors can be linked or be
//           partners; deactivating removes the partner badge
// - PTY-R6  a vendor with equipment, products or requests cannot be deleted
// - PTY-R7  public partner data: name, company name, logo, website only
// - PTY-R15 public registration: honeypot fake success, Turnstile, rate limit, consent

import "server-only";
import { Errors } from "@/server/core/errors";
import { appUrl, brandedEmail, sendMail } from "@/server/integrations/mailer";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { normalizeEmail, normalizePhone } from "../parties.fields";
import { resolveUpload } from "../parties.files";
import type {
  CreateVendorData,
  ListVendorsData,
  SetVendorPartnerData,
  SetVendorStatusData,
  SubmitVendorData,
  UpdateVendorData,
  VendorIdData,
} from "./vendor.schema";
import {
  vendorDetailSelect,
  vendorListSelect,
  vendorPartnerSelect,
  vendorRefSelect,
  type PartnersResult,
  type VendorDetail,
  type VendorListPage,
  type VendorPartner,
  type VendorRef,
} from "./vendor.select";

type Actor = { actor: SessionUser };
type VendorType = VendorDetail["type"];

// PTY-R7: the one definition of "public partner".
const partnerWhere = { status: "APPROVED", isPartner: true } satisfies Prisma.VendorWhereInput;

const toPartner = (v: VendorPartner): VendorPartner => ({
  id: v.id,
  name: v.name,
  companyName: v.companyName,
  logo: v.logo,
  website: v.website,
});

// ======================= Reads =======================

export async function listVendors(query: ListVendorsData): Promise<VendorListPage> {
  const and: Prisma.VendorWhereInput[] = [];
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { companyName: { contains: query.q, mode: "insensitive" } },
        { offerings: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q.toLowerCase() } },
        { phone: { contains: normalizePhone(query.q) ?? query.q.replace(/\s/g, "") } },
      ],
    });
  }
  if (query.type) and.push({ type: query.type });
  if (query.status) and.push({ status: query.status });
  if (query.district) and.push({ district: { contains: query.district, mode: "insensitive" } });
  if (query.partner !== undefined) and.push({ isPartner: query.partner });
  const rows = await db.vendor.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    select: vendorListSelect,
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getVendorDetail(id: string, ctx: Actor): Promise<VendorDetail | null> {
  const row = await db.vendor.findUnique({ where: { id }, select: vendorDetailSelect });
  if (!row) return null;
  const linked = row.equipment.length + row.products.length + row.supplyOrders.length + row.serviceRequests.length;
  return {
    ...row,
    can: {
      approve: hasPermission(ctx.actor, "vendor:update") && row.status !== "APPROVED",
      deactivate: hasPermission(ctx.actor, "vendor:update") && row.status === "APPROVED",
      partner: hasPermission(ctx.actor, "vendor:partner") && row.status === "APPROVED",
      delete: hasPermission(ctx.actor, "vendor:delete") && linked === 0,
    },
  };
}

// PTY-R7.
export async function listPartners(): Promise<PartnersResult> {
  const [partners, shops] = await Promise.all([listPartnerLogos(), listFeaturedShops()]);
  return { partners, shops };
}

export async function listPartnerLogos(): Promise<VendorPartner[]> {
  const rows = await db.vendor.findMany({
    where: { ...partnerWhere, logo: { not: null } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: vendorPartnerSelect,
    take: 50,
  });
  return rows.map(toPartner);
}

export async function listFeaturedShops(): Promise<VendorPartner[]> {
  const rows = await db.vendor.findMany({
    where: { ...partnerWhere, type: "SUPPLIER", website: { not: null } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: vendorPartnerSelect,
    take: 24,
  });
  return rows.map(toPartner);
}

export function countPendingVendors(): Promise<number> {
  return db.vendor.count({ where: { status: "PENDING" } });
}

// ======================= Writes =======================

// PTY-R1, R2, R5 (staff-created vendors also start PENDING).
export async function createVendor(data: CreateVendorData): Promise<VendorRef> {
  const logo = data.logo ? await resolveUpload(data.logo, "logo", true) : null;
  return db.$transaction(async (tx) => {
    await assertContactFree({ phone: data.phone, email: data.email, tin: data.tin }, tx);
    return tx.vendor.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        type: data.type,
        entityType: data.entityType,
        companyName: data.entityType === "COMPANY" ? data.companyName : null,
        tin: data.tin,
        district: data.district,
        offerings: data.offerings,
        logo,
        website: data.website,
        notes: data.notes,
      },
      select: vendorRefSelect,
    });
  });
}

// PTY-R1, R2 on the merged values.
export async function updateVendor(data: UpdateVendorData): Promise<VendorRef> {
  const logo = data.logo ? await resolveUpload(data.logo, "logo", true) : data.logo;
  return db.$transaction(async (tx) => {
    const current = await tx.vendor.findUnique({ where: { id: data.id }, select: { phone: true, email: true, entityType: true, companyName: true } });
    if (!current) throw Errors.notFound("Vendor");
    const phone = data.phone !== undefined ? data.phone : current.phone;
    const email = data.email !== undefined ? data.email : current.email;
    if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });
    const entityType = data.entityType ?? current.entityType;
    const companyName = data.companyName !== undefined ? data.companyName : current.companyName;
    if (entityType === "COMPANY" && !companyName) throw Errors.invalid("Enter the company name.", { companyName: ["Enter the company name."] });
    await assertContactFree({ phone: data.phone, email: data.email, tin: data.tin, exceptId: data.id }, tx);
    return tx.vendor.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        type: data.type,
        entityType: data.entityType,
        companyName: entityType === "COMPANY" ? data.companyName : null,
        tin: data.tin,
        district: data.district,
        offerings: data.offerings,
        logo,
        website: data.website,
        notes: data.notes,
      },
      select: vendorRefSelect,
    });
  });
}

// PTY-R5: approve or deactivate; deactivating removes the partner badge.
export async function setVendorStatus(data: SetVendorStatusData): Promise<VendorRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.vendor.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Vendor");
    if (current.status === data.status) throw Errors.conflict(`This vendor is already ${data.status.toLowerCase()}.`);
    const { count } = await tx.vendor.updateMany({
      where: { id: data.id, status: current.status },
      data: { status: data.status, ...(data.status === "INACTIVE" ? { isPartner: false } : {}) },
    });
    if (count === 0) throw Errors.conflict("This vendor was changed by someone else. Reload and try again.");
    return tx.vendor.findUniqueOrThrow({ where: { id: data.id }, select: vendorRefSelect });
  });
}

// PTY-R5: only APPROVED vendors can be partners.
export async function setVendorPartner(data: SetVendorPartnerData): Promise<VendorRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.vendor.findUnique({ where: { id: data.id }, select: { status: true, isPartner: true } });
    if (!current) throw Errors.notFound("Vendor");
    if (data.isPartner && current.status !== "APPROVED") throw Errors.conflict("Approve this vendor before marking it as a partner.");
    if (current.isPartner === data.isPartner) throw Errors.conflict(data.isPartner ? "Already a partner." : "Not a partner.");
    const { count } = await tx.vendor.updateMany({
      where: { id: data.id, ...(data.isPartner ? { status: "APPROVED" } : {}) },
      data: { isPartner: data.isPartner },
    });
    if (count === 0) throw Errors.conflict("This vendor was changed by someone else. Reload and try again.");
    return tx.vendor.findUniqueOrThrow({ where: { id: data.id }, select: vendorRefSelect });
  });
}

// PTY-R6.
export async function deleteVendor({ id }: VendorIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const row = await tx.vendor.findUnique({
      where: { id },
      select: { _count: { select: { equipment: true, products: true, supplyOrders: true, serviceRequests: true } } },
    });
    if (!row) throw Errors.notFound("Vendor");
    const c = row._count;
    if (c.equipment + c.products + c.supplyOrders + c.serviceRequests > 0) {
      throw Errors.conflict("This vendor is linked to equipment, products or requests. Set it to Inactive instead.");
    }
    await tx.vendor.delete({ where: { id } });
    return { id };
  });
}

// PUBLIC (PTY-R3, R15). The reply never says whether the vendor was known.
export async function submitVendor(data: SubmitVendorData, meta: RequestMeta): Promise<{ received: true }> {
  if (isBot(data.fax)) return { received: true };
  await guardPublicWrite({ scope: "submit-vendor", meta, turnstileToken: data.turnstileToken });
  const result = await db.$transaction((tx) =>
    findOrCreateVendor(
      {
        returning: data.returning,
        phone: data.phone,
        email: data.email,
        name: data.name,
        entityType: data.entityType,
        companyName: data.companyName,
        tin: data.tin,
        district: data.district,
        type: data.type,
        offerings: data.offerings ?? "",
      },
      tx,
    ),
  );
  if (result.created) {
    await notifyStaff(result.id, data.name ?? "A vendor").catch((err) => console.error("[parties] vendor email failed", err));
  }
  return { received: true };
}

// ======================= Shared with other modules (D-2) =======================

export type VendorContactInput = {
  returning: boolean;
  phone: string | null;
  email: string | null;
  name: string | null;
  entityType: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  tin: string | null;
  district: string | null;
  type: VendorType;
  offerings: string;
};

// PTY-R3: catalog (submitEquipment) and submitVendor. Never changes a stored vendor.
export async function findOrCreateVendor(input: VendorContactInput, client: DbClient): Promise<{ id: string; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });
  const found =
    (phone ? await client.vendor.findUnique({ where: { phone }, select: { id: true } }) : null) ??
    (email ? await client.vendor.findUnique({ where: { email }, select: { id: true } }) : null);
  if (found) return { id: found.id, created: false };
  if (input.returning) {
    throw Errors.invalid("We could not find your details. Choose “No” and fill them in.", {
      phone: ["We could not find this phone or email."],
    });
  }
  const name = input.name?.trim();
  if (!name || name.length < 2) throw Errors.invalid("Enter your name.", { contactName: ["Enter your name."], name: ["Enter your name."] });
  const isCompany = input.entityType === "COMPANY";
  const tinFree = input.tin ? !(await client.vendor.findUnique({ where: { tin: input.tin }, select: { id: true } })) : false;
  const created = await client.vendor.create({
    data: {
      name,
      phone,
      email,
      type: input.type,
      entityType: input.entityType,
      companyName: isCompany ? input.companyName : null,
      tin: isCompany && tinFree ? input.tin : null,
      district: input.district,
      offerings: input.offerings || "-",
      status: "PENDING",
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// PTY-R5: operations links only APPROVED vendors to requests.
export async function assertApprovedVendor(id: string, client: DbClient): Promise<void> {
  const vendor = await client.vendor.findUnique({ where: { id }, select: { status: true } });
  if (!vendor) throw Errors.invalid("Choose a vendor.", { vendorId: ["Vendor not found."] });
  if (vendor.status !== "APPROVED") throw Errors.invalid("Only approved vendors can be linked.", { vendorId: ["This vendor is not approved."] });
}

// ======================= Helpers (not exported) =======================

async function assertContactFree(
  d: { phone?: string | null; email?: string | null; tin?: string | null; exceptId?: string },
  client: DbClient,
) {
  const checks: [string, Prisma.VendorWhereUniqueInput | null][] = [
    ["phone", d.phone ? { phone: d.phone } : null],
    ["email", d.email ? { email: d.email } : null],
    ["tin", d.tin ? { tin: d.tin } : null],
  ];
  for (const [field, where] of checks) {
    if (!where) continue;
    const row = await client.vendor.findUnique({ where, select: { id: true } });
    if (row && row.id !== d.exceptId) throw Errors.conflict("Another vendor already uses this value.", { [field]: ["Already in use."] });
  }
}

async function notifyStaff(vendorId: string, name: string) {
  const to = process.env.STAFF_NOTIFY_EMAIL;
  if (!to) return;
  const mail = brandedEmail({
    title: "New vendor registration",
    lines: [`${name} registered through "Partner with us" and is waiting for review.`],
    button: { label: "Open in dashboard", url: appUrl(`/admin/vendors/${vendorId}`) },
  });
  await sendMail({ to, subject: `New vendor registration: ${name}`, ...mail });
}
