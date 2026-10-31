// CLIENT SERVICE: customers, identified by phone or email (no accounts).
//
// Rules:
// - PTY-R1 phone / email normalised; at least one; unique (checked here first,
//          the database @unique is the safety net)
// - PTY-R2 COMPANY needs a company name; TIN 9 digits, unique
// - PTY-R3 findOrCreateClient: by phone, then email; never overwrites stored
//          details; "returning" with an unknown contact is a VALIDATION error
// - PTY-R4 a client with requests cannot be deleted

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { toPartiesOut } from "../parties.dates";
import { normalizeEmail, normalizePhone } from "../parties.fields";
import type { ClientIdData, CreateClientData, ListClientsData, UpdateClientData } from "./client.schema";
import {
  clientDetailSelect,
  clientListSelect,
  clientPaymentSelect,
  clientRefSelect,
  type ClientDetail,
  type ClientListPage,
  type ClientRef,
} from "./client.select";

type Actor = { actor: SessionUser };

// ======================= Reads =======================

export async function listClients(query: ListClientsData): Promise<ClientListPage> {
  const where: Prisma.ClientWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { companyName: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q.toLowerCase() } },
          { phone: { contains: normalizePhone(query.q) ?? query.q.replace(/\s/g, "") } },
          { tin: { contains: query.q } },
        ],
      }
    : {};
  const rows = await db.client.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: clientListSelect,
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getClientDetail(id: string, ctx: Actor): Promise<ClientDetail | null> {
  const row = await db.client.findUnique({ where: { id }, select: clientDetailSelect });
  if (!row) return null;
  const payments = await db.payment.findMany({
    where: {
      OR: [
        { equipmentRequest: { is: { clientId: id } } },
        { supplyOrder: { is: { clientId: id } } },
        { serviceRequest: { is: { clientId: id } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: clientPaymentSelect,
    take: 200,
  });
  const requests = row.equipmentRequests.length + row.supplyOrders.length + row.serviceRequests.length + row.workforceRequests.length;
  return {
    ...row,
    payments: toPartiesOut(payments),
    can: { delete: hasPermission(ctx.actor, "client:delete") && requests === 0 },
  };
}

// ======================= Writes =======================

// PTY-R1, R2.
export async function createClient(data: CreateClientData): Promise<ClientRef> {
  return db.$transaction(async (tx) => {
    await assertContactFree({ phone: data.phone, email: data.email, tin: data.tin }, tx);
    return tx.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        entityType: data.entityType,
        companyName: data.entityType === "COMPANY" ? data.companyName : null,
        tin: data.tin,
        district: data.district,
        notes: data.notes,
      },
      select: clientRefSelect,
    });
  });
}

// PTY-R1, R2 (checked on the merged values).
export async function updateClient(data: UpdateClientData): Promise<ClientRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.client.findUnique({
      where: { id: data.id },
      select: { phone: true, email: true, entityType: true, companyName: true },
    });
    if (!current) throw Errors.notFound("Client");
    const phone = data.phone !== undefined ? data.phone : current.phone;
    const email = data.email !== undefined ? data.email : current.email;
    if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });
    const entityType = data.entityType ?? current.entityType;
    const companyName = data.companyName !== undefined ? data.companyName : current.companyName;
    if (entityType === "COMPANY" && !companyName) throw Errors.invalid("Enter the company name.", { companyName: ["Enter the company name."] });
    await assertContactFree({ phone: data.phone, email: data.email, tin: data.tin, exceptId: data.id }, tx);
    return tx.client.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        entityType: data.entityType,
        companyName: entityType === "COMPANY" ? data.companyName : null,
        tin: data.tin,
        district: data.district,
        notes: data.notes,
      },
      select: clientRefSelect,
    });
  });
}

// PTY-R4.
export async function deleteClient({ id }: ClientIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const row = await tx.client.findUnique({ where: { id }, select: { _count: { select: clientListSelect._count.select } } });
    if (!row) throw Errors.notFound("Client");
    const c = row._count;
    if (c.equipmentRequests + c.supplyOrders + c.serviceRequests + c.workforceRequests > 0) {
      throw Errors.conflict("This client has requests and cannot be deleted.");
    }
    await tx.client.delete({ where: { id } });
    return { id };
  });
}

// ======================= Shared with other modules (D-2) =======================

export type ClientContactInput = {
  returning: boolean;
  phone: string | null;
  email: string | null;
  name: string | null;
  entityType: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  tin: string | null;
  district: string | null;
};

// PTY-R3: operations (public requests). Finds by phone, then by email, and
// never changes a stored client. Creates one only for a new contact.
export async function findOrCreateClient(input: ClientContactInput, client: DbClient): Promise<{ id: string; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phone && !email) throw Errors.invalid("Enter a phone number or an email.", { phone: ["Enter a phone number or an email."] });

  const found = await findByContact(phone, email, client);
  if (found) return { id: found.id, created: false };
  if (input.returning) {
    throw Errors.invalid("We could not find your details. Choose “No” and fill them in.", {
      phone: ["We could not find this phone or email."],
    });
  }
  const name = input.name?.trim();
  if (!name || name.length < 2) throw Errors.invalid("Enter your name.", { name: ["Enter your name."] });
  const isCompany = input.entityType === "COMPANY";
  if (isCompany && !input.companyName) throw Errors.invalid("Enter the company name.", { companyName: ["Enter the company name."] });
  // A TIN already on file belongs to someone else: staff complete it later.
  const tinFree = input.tin ? !(await client.client.findUnique({ where: { tin: input.tin }, select: { id: true } })) : false;
  const created = await client.client.create({
    data: {
      name,
      phone,
      email,
      entityType: input.entityType,
      companyName: isCompany ? input.companyName : null,
      tin: isCompany && tinFree ? input.tin : null,
      district: input.district,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// Access (reviews): the client a phone or email belongs to, if any.
export async function findClientIdByContact(contact: { phone: string | null; email: string | null }, client: DbClient): Promise<string | null> {
  const found = await findByContact(normalizePhone(contact.phone), normalizeEmail(contact.email), client);
  return found?.id ?? null;
}

// Operations (staff-created requests): the client must exist.
export async function assertClientExists(id: string, client: DbClient): Promise<void> {
  const row = await client.client.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw Errors.invalid("Choose a client.", { clientId: ["Client not found."] });
}

// ======================= Helpers (not exported) =======================

async function findByContact(phone: string | null, email: string | null, client: DbClient) {
  if (phone) {
    const byPhone = await client.client.findUnique({ where: { phone }, select: { id: true } });
    if (byPhone) return byPhone;
  }
  if (email) return client.client.findUnique({ where: { email }, select: { id: true } });
  return null;
}

// PTY-R1, R2: clear field errors before the database's unique constraint.
async function assertContactFree(
  d: { phone?: string | null; email?: string | null; tin?: string | null; exceptId?: string },
  client: DbClient,
) {
  const checks: [string, Prisma.ClientWhereUniqueInput | null][] = [
    ["phone", d.phone ? { phone: d.phone } : null],
    ["email", d.email ? { email: d.email } : null],
    ["tin", d.tin ? { tin: d.tin } : null],
  ];
  for (const [field, where] of checks) {
    if (!where) continue;
    const row = await client.client.findUnique({ where, select: { id: true } });
    if (row && row.id !== d.exceptId) throw Errors.conflict("Another client already uses this value.", { [field]: ["Already in use."] });
  }
}
