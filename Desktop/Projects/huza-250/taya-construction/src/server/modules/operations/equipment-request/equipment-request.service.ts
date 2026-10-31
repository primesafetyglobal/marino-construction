// EQUIPMENT REQUEST SERVICE: rent or buy requests; completed rentals form the
// equipment's rent history.
//
// Rules:
// - OPS-R1  code EQ-0001 from number
// - OPS-R2  public requests find or create the client; reply = code only
// - OPS-R3  public: NEW + WEBSITE; staff: existing client + PHONE / WHATSAPP / WALK_IN
// - OPS-R4  allowed status moves only; never deleted (cancel)
// - OPS-R5  end ≥ start; ACTIVE only for RENT (and BUY completes from CONFIRMED)
// - OPS-R6  equipment side effects in the same transaction
// - OPS-R7  one ACTIVE rental per equipment (row lock)
// - OPS-R10 public requests need a public equipment item
// - OPS-R14 the handler is an active user
// - OPS-R15 staff email after commit
// - OPS-R16 honeypot fake success, Turnstile, rate limit, consent
//
// D-2: imports parties/client (findOrCreateClient, assertClientExists) and
// catalog/equipment (assertPublicEquipment, lockEquipmentForRental, setEquipmentStatusShared).

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { assertClientExists, findOrCreateClient } from "@/server/modules/parties/client/client.service";
import {
  assertPublicEquipment,
  lockEquipmentForRental,
  setEquipmentStatusShared,
} from "@/server/modules/catalog/equipment/equipment.service";
import { toDateOrNull, toOpsOut } from "../operations.dates";
import { notifyNewRequest } from "../operations.notify";
import { fakeCode, parseCode, requestCode } from "../operations.reference";
import { canMove, equipmentRequestMoves, EQUIPMENT_REQUEST_MOVES } from "../operations.status";
import type {
  CreateEquipmentRequestData,
  ListEquipmentRequestsData,
  SetEquipmentRequestHandlerData,
  SetEquipmentRequestStatusData,
  SubmitEquipmentRequestData,
  UpdateEquipmentRequestData,
} from "./equipment-request.schema";
import {
  equipmentRequestDetailSelect,
  equipmentRequestListSelect,
  equipmentRequestRefSelect,
  type EquipmentRequestDetail,
  type EquipmentRequestListPage,
  type EquipmentRequestRef,
} from "./equipment-request.select";

type Actor = { actor: SessionUser };
const KIND = "EQUIPMENT_REQUEST" as const;
const code = (n: number) => requestCode(KIND, n);
const STALE = "This request was changed by someone else. Reload and try again.";

// ======================= Reads =======================

export async function listEquipmentRequests(query: ListEquipmentRequestsData, ctx: Actor): Promise<EquipmentRequestListPage> {
  const and: Prisma.EquipmentRequestWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.type) and.push({ type: query.type });
  if (query.clientId) and.push({ clientId: query.clientId });
  if (query.handler === "me") and.push({ handledById: ctx.actor.id });
  else if (query.handler === "none") and.push({ handledById: null });
  else if (query.handler) and.push({ handledById: query.handler });
  if (query.q) {
    const parsed = parseCode(query.q);
    and.push({
      OR: [
        ...(parsed?.kind === KIND ? [{ number: parsed.number }] : /^\d+$/.test(query.q) ? [{ number: Number(query.q) }] : []),
        { client: { is: { name: { contains: query.q, mode: "insensitive" } } } },
        { client: { is: { companyName: { contains: query.q, mode: "insensitive" } } } },
        { equipment: { is: { name: { contains: query.q, mode: "insensitive" } } } },
        { details: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const rows = await db.equipmentRequest.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: equipmentRequestListSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => ({ ...toOpsOut(r), code: code(r.number) })), nextCursor: page.nextCursor };
}

export async function getEquipmentRequestDetail(id: string, ctx: Actor): Promise<EquipmentRequestDetail | null> {
  const row = await db.equipmentRequest.findUnique({ where: { id }, select: equipmentRequestDetailSelect });
  if (!row) return null;
  const canUpdate = hasPermission(ctx.actor, "equipment-request:update");
  return {
    ...toOpsOut(row),
    code: code(row.number),
    can: { update: canUpdate, moves: canUpdate ? equipmentRequestMoves(row.status, row.type) : [] },
  };
}

// Completed rentals of one machine (Data Model: getEquipmentRentHistory).
export async function listRentHistory(equipmentId: string) {
  const rows = await db.equipmentRequest.findMany({
    where: { equipmentId, type: "RENT", status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    select: equipmentRequestListSelect,
    take: 100,
  });
  return rows.map((r) => ({ ...toOpsOut(r), code: code(r.number) }));
}

// ======================= Writes =======================

// PUBLIC (OPS-R2, R3, R10, R15, R16). Returns only the code.
export async function submitEquipmentRequest(data: SubmitEquipmentRequestData, meta: RequestMeta): Promise<{ code: string }> {
  if (isBot(data.fax)) return { code: fakeCode(KIND) };
  await guardPublicWrite({ scope: "submit-request", meta, turnstileToken: data.turnstileToken });
  const created = await db.$transaction(async (tx) => {
    if (data.equipmentId) await assertPublicEquipment(data.equipmentId, { publicOnly: true }, tx);
    const client = await findOrCreateClient(
      { returning: data.returning, phone: data.phone, email: data.email, name: data.name, entityType: data.entityType, companyName: data.companyName, tin: data.tin, district: data.district },
      tx,
    );
    return tx.equipmentRequest.create({
      data: {
        type: data.type,
        clientId: client.id,
        equipmentId: data.equipmentId ?? null,
        details: data.details,
        siteLocation: data.siteLocation,
        startDate: toDateOrNull(data.startDate),
        endDate: toDateOrNull(data.endDate),
        source: "WEBSITE",
      },
      select: { id: true, number: true, client: { select: { name: true } }, equipment: { select: { name: true } } },
    });
  });
  await notifyNewRequest(KIND, {
    id: created.id,
    number: created.number,
    clientName: created.client.name,
    summary: `${data.type === "RENT" ? "Rent" : "Buy"}: ${created.equipment?.name ?? "equipment sourcing"}. ${data.details}`,
  }).catch((err) => console.error("[operations] request email failed", err));
  return { code: code(created.number) };
}

// OPS-R3: staff create for phone / walk-in clients.
export async function createEquipmentRequest(data: CreateEquipmentRequestData): Promise<EquipmentRequestRef> {
  const row = await db.$transaction(async (tx) => {
    await assertClientExists(data.clientId, tx);
    if (data.equipmentId) await assertPublicEquipment(data.equipmentId, { publicOnly: false }, tx);
    return tx.equipmentRequest.create({
      data: {
        type: data.type,
        clientId: data.clientId,
        equipmentId: data.equipmentId ?? null,
        details: data.details,
        siteLocation: data.siteLocation,
        startDate: toDateOrNull(data.startDate),
        endDate: toDateOrNull(data.endDate),
        quotedAmount: data.quotedAmount ?? null,
        notes: data.notes,
        source: data.source,
      },
      select: equipmentRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R5 (dates checked on the merged values).
export async function updateEquipmentRequest(data: UpdateEquipmentRequestData): Promise<EquipmentRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.equipmentRequest.findUnique({ where: { id: data.id }, select: { startDate: true, endDate: true, status: true } });
    if (!current) throw Errors.notFound("Request");
    const start = data.startDate !== undefined ? toDateOrNull(data.startDate) : current.startDate;
    const end = data.endDate !== undefined ? toDateOrNull(data.endDate) : current.endDate;
    if (start && end && end < start) throw Errors.invalid("The end date is before the start date.", { endDate: ["Before the start date."] });
    if (data.equipmentId) {
      if (current.status === "ACTIVE") throw Errors.conflict("Complete or cancel the rental before changing the equipment.");
      await assertPublicEquipment(data.equipmentId, { publicOnly: false }, tx);
    }
    return tx.equipmentRequest.update({
      where: { id: data.id },
      data: {
        equipmentId: data.equipmentId,
        details: data.details,
        siteLocation: data.siteLocation,
        startDate: data.startDate !== undefined ? start : undefined,
        endDate: data.endDate !== undefined ? end : undefined,
        quotedAmount: data.quotedAmount,
        notes: data.notes,
      },
      select: equipmentRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R4, R5, R6, R7.
export async function setEquipmentRequestStatus(data: SetEquipmentRequestStatusData): Promise<EquipmentRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.equipmentRequest.findUnique({ where: { id: data.id }, select: { status: true, type: true, equipmentId: true } });
    if (!current) throw Errors.notFound("Request");
    const from = current.status;
    const to = data.status;
    if (!canMove(EQUIPMENT_REQUEST_MOVES, from, to)) throw Errors.conflict(`A request cannot move from ${from} to ${to}.`);
    if (to === "ACTIVE" && current.type !== "RENT") throw Errors.conflict("Only rentals can become active.");
    if (from === "CONFIRMED" && to === "COMPLETED" && current.type === "RENT") throw Errors.conflict("Start the rental (Active) before completing it.");

    // OPS-R6, R7: equipment side effects, with the machine's row locked.
    if (current.equipmentId) {
      if (to === "ACTIVE") {
        const equipment = await lockEquipmentForRental(current.equipmentId, tx);
        const otherActive = await tx.equipmentRequest.count({ where: { equipmentId: current.equipmentId, status: "ACTIVE", id: { not: data.id } } });
        if (otherActive > 0 || equipment.status !== "AVAILABLE") throw Errors.conflict("This equipment is already rented or not available.");
        await setEquipmentStatusShared(current.equipmentId, "RENTED", tx);
      } else if (from === "ACTIVE" && (to === "COMPLETED" || to === "CANCELLED")) {
        await lockEquipmentForRental(current.equipmentId, tx);
        await setEquipmentStatusShared(current.equipmentId, "AVAILABLE", tx);
      } else if (to === "COMPLETED" && current.type === "BUY") {
        const equipment = await lockEquipmentForRental(current.equipmentId, tx);
        if (equipment.status === "RENTED") throw Errors.conflict("This equipment is rented. Complete the rental before the sale.");
        await setEquipmentStatusShared(current.equipmentId, "SOLD", tx);
      }
    } else if (to === "ACTIVE") {
      throw Errors.conflict("Link an equipment item before starting the rental.");
    }

    const { count } = await tx.equipmentRequest.updateMany({ where: { id: data.id, status: from }, data: { status: to } });
    if (count === 0) throw Errors.conflict(STALE);
    return tx.equipmentRequest.findUniqueOrThrow({ where: { id: data.id }, select: equipmentRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R14.
export async function setEquipmentRequestHandler(data: SetEquipmentRequestHandlerData): Promise<EquipmentRequestRef> {
  const row = await db.$transaction(async (tx) => {
    if (data.handledById) await assertActiveUser(data.handledById, tx);
    const exists = await tx.equipmentRequest.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!exists) throw Errors.notFound("Request");
    return tx.equipmentRequest.update({ where: { id: data.id }, data: { handledById: data.handledById }, select: equipmentRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// ======================= Shared with other modules (D-2) =======================

// Parties (payments): the request exists, and its quoted amount.
export async function getPayableEquipmentRequest(id: string, client: DbClient) {
  return client.equipmentRequest.findUnique({ where: { id }, select: { id: true, quotedAmount: true, status: true } });
}

// ======================= Shared with other services (operations only) =======================

// OPS-R14: the handler must be an active user (User relation, DNSA 13.2).
export async function assertActiveUser(userId: string, client: DbClient) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user || !user.isActive) throw Errors.invalid("Choose an active staff member.", { handledById: ["Not an active user."] });
}
