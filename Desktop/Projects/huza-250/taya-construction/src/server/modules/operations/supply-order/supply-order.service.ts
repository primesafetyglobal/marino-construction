// SUPPLY ORDER SERVICE: materials requests; delivered orders form the supply history.
//
// Rules:
// - OPS-R1  code SO-0001
// - OPS-R2  public orders find or create the client; reply = code only
// - OPS-R3  public: NEW + WEBSITE; staff: existing client + staff source
// - OPS-R4  allowed status moves only; never deleted (cancel)
// - OPS-R8  the linked vendor must be APPROVED
// - OPS-R10 a product in a public order must be available
// - OPS-R14 the handler is an active user
// - OPS-R15 staff email after commit
// - OPS-R16 honeypot fake success, Turnstile, rate limit, consent
//
// D-2: imports parties/client, parties/vendor (assertApprovedVendor), catalog/product (assertPublicProduct).

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { assertClientExists, findOrCreateClient } from "@/server/modules/parties/client/client.service";
import { assertApprovedVendor } from "@/server/modules/parties/vendor/vendor.service";
import { assertPublicProduct } from "@/server/modules/catalog/product/product.service";
import { toDateOrNull, toOpsOut } from "../operations.dates";
import { notifyNewRequest } from "../operations.notify";
import { fakeCode, parseCode, requestCode } from "../operations.reference";
import { canMove, SUPPLY_ORDER_MOVES } from "../operations.status";
import { assertActiveUser } from "../equipment-request/equipment-request.service";
import type {
  CreateSupplyOrderData,
  ListSupplyOrdersData,
  SetSupplyOrderHandlerData,
  SetSupplyOrderStatusData,
  SubmitSupplyOrderData,
  UpdateSupplyOrderData,
} from "./supply-order.schema";
import {
  supplyOrderDetailSelect,
  supplyOrderListSelect,
  supplyOrderRefSelect,
  type SupplyOrderDetail,
  type SupplyOrderListPage,
  type SupplyOrderRef,
} from "./supply-order.select";

type Actor = { actor: SessionUser };
const KIND = "SUPPLY_ORDER" as const;
const code = (n: number) => requestCode(KIND, n);

// ======================= Reads =======================

export async function listSupplyOrders(query: ListSupplyOrdersData, ctx: Actor): Promise<SupplyOrderListPage> {
  const and: Prisma.SupplyOrderWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
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
        { items: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const rows = await db.supplyOrder.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: supplyOrderListSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => ({ ...toOpsOut(r), code: code(r.number) })), nextCursor: page.nextCursor };
}

export async function getSupplyOrderDetail(id: string, ctx: Actor): Promise<SupplyOrderDetail | null> {
  const row = await db.supplyOrder.findUnique({ where: { id }, select: supplyOrderDetailSelect });
  if (!row) return null;
  const canUpdate = hasPermission(ctx.actor, "supply-order:update");
  return { ...toOpsOut(row), code: code(row.number), can: { update: canUpdate, moves: canUpdate ? [...(SUPPLY_ORDER_MOVES[row.status] ?? [])] : [] } };
}

// ======================= Writes =======================

// PUBLIC (OPS-R2, R3, R10, R15, R16).
export async function submitSupplyOrder(data: SubmitSupplyOrderData, meta: RequestMeta): Promise<{ code: string }> {
  if (isBot(data.fax)) return { code: fakeCode(KIND) };
  await guardPublicWrite({ scope: "submit-request", meta, turnstileToken: data.turnstileToken });
  const created = await db.$transaction(async (tx) => {
    if (data.productId) await assertPublicProduct(data.productId, { publicOnly: true }, tx);
    const client = await findOrCreateClient(
      { returning: data.returning, phone: data.phone, email: data.email, name: data.name, entityType: data.entityType, companyName: data.companyName, tin: data.tin, district: data.district },
      tx,
    );
    return tx.supplyOrder.create({
      data: {
        clientId: client.id,
        productId: data.productId ?? null,
        items: data.items,
        deliveryLocation: data.deliveryLocation,
        deliveryDate: toDateOrNull(data.deliveryDate),
        source: "WEBSITE",
      },
      select: { id: true, number: true, client: { select: { name: true } } },
    });
  });
  await notifyNewRequest(KIND, { id: created.id, number: created.number, clientName: created.client.name, summary: data.items }).catch((err) =>
    console.error("[operations] request email failed", err),
  );
  return { code: code(created.number) };
}

// OPS-R3, R8.
export async function createSupplyOrder(data: CreateSupplyOrderData): Promise<SupplyOrderRef> {
  const row = await db.$transaction(async (tx) => {
    await assertClientExists(data.clientId, tx);
    if (data.productId) await assertPublicProduct(data.productId, { publicOnly: false }, tx);
    if (data.vendorId) await assertApprovedVendor(data.vendorId, tx);
    return tx.supplyOrder.create({
      data: {
        clientId: data.clientId,
        productId: data.productId ?? null,
        vendorId: data.vendorId ?? null,
        items: data.items,
        deliveryLocation: data.deliveryLocation,
        deliveryDate: toDateOrNull(data.deliveryDate),
        quotedAmount: data.quotedAmount ?? null,
        notes: data.notes,
        source: data.source,
      },
      select: supplyOrderRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R8.
export async function updateSupplyOrder(data: UpdateSupplyOrderData): Promise<SupplyOrderRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.supplyOrder.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!current) throw Errors.notFound("Order");
    if (data.productId) await assertPublicProduct(data.productId, { publicOnly: false }, tx);
    if (data.vendorId) await assertApprovedVendor(data.vendorId, tx);
    return tx.supplyOrder.update({
      where: { id: data.id },
      data: {
        productId: data.productId,
        vendorId: data.vendorId,
        items: data.items,
        deliveryLocation: data.deliveryLocation,
        deliveryDate: data.deliveryDate !== undefined ? toDateOrNull(data.deliveryDate) : undefined,
        quotedAmount: data.quotedAmount,
        notes: data.notes,
      },
      select: supplyOrderRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R4.
export async function setSupplyOrderStatus(data: SetSupplyOrderStatusData): Promise<SupplyOrderRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.supplyOrder.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Order");
    if (!canMove(SUPPLY_ORDER_MOVES, current.status, data.status)) throw Errors.conflict(`An order cannot move from ${current.status} to ${data.status}.`);
    const { count } = await tx.supplyOrder.updateMany({ where: { id: data.id, status: current.status }, data: { status: data.status } });
    if (count === 0) throw Errors.conflict("This order was changed by someone else. Reload and try again.");
    return tx.supplyOrder.findUniqueOrThrow({ where: { id: data.id }, select: supplyOrderRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R14.
export async function setSupplyOrderHandler(data: SetSupplyOrderHandlerData): Promise<SupplyOrderRef> {
  const row = await db.$transaction(async (tx) => {
    if (data.handledById) await assertActiveUser(data.handledById, tx);
    const exists = await tx.supplyOrder.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!exists) throw Errors.notFound("Order");
    return tx.supplyOrder.update({ where: { id: data.id }, data: { handledById: data.handledById }, select: supplyOrderRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// ======================= Shared with other modules (D-2) =======================

// Parties (payments): the order exists, and its quoted amount.
export async function getPayableSupplyOrder(id: string, client: DbClient) {
  return client.supplyOrder.findUnique({ where: { id }, select: { id: true, quotedAmount: true, status: true } });
}
