// PAYMENT SERVICE: payments and installments on requests.
//
// Rules:
// - PTY-R9  a payment belongs to exactly one request (one of three links)
// - PTY-R10 PAID needs a method; paidAt is set when PAID
// - PTY-R11 an installment plan is for a service request with plan
//           INSTALLMENT and a quoted amount; plan + existing payments add up
//           exactly to the quoted amount; payments never exceed the quoted
//           amount (Serializable transactions: P2034 → CONFLICT)
// - PTY-R12 PAID payments cannot be deleted
// - PTY-R13 overdue = DUE with a due date before today (Africa/Kigali)
//
// D-2: imports operations getPayable* (request existence and quotedAmount).

import "server-only";
import { Errors } from "@/server/core/errors";
import { db, Prisma, type DbClient } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { getPayableEquipmentRequest } from "@/server/modules/operations/equipment-request/equipment-request.service";
import { getPayableServiceRequest } from "@/server/modules/operations/service-request/service-request.service";
import { getPayableSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.service";
import { REQUEST_PATH, requestCode } from "../parties.codes";
import { toDate, today, toPartiesOut } from "../parties.dates";
import { sum } from "../parties.money";
import type { PayableType } from "../parties.select";
import type {
  CreateInstallmentPlanData,
  ListPaymentsData,
  MarkPaymentPaidData,
  PaymentIdData,
  RecordPaymentData,
} from "./payment.schema";
import {
  paymentRefSelect,
  paymentSelect,
  type PaymentItem,
  type PaymentListPage,
  type PaymentRef,
  type PaymentSummary,
  type PaymentTotals,
  type RequestPayments,
} from "./payment.select";

type Row = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

// PTY-R13: the one definition of "overdue".
export const overdueWhere = (day = today()): Prisma.PaymentWhereInput => ({ status: "DUE", dueDate: { lt: toDate(day) } });

const LINK: Record<PayableType, "equipmentRequestId" | "supplyOrderId" | "serviceRequestId"> = {
  EQUIPMENT_REQUEST: "equipmentRequestId",
  SUPPLY_ORDER: "supplyOrderId",
  SERVICE_REQUEST: "serviceRequestId",
};

function toItem(row: Row, day: string): PaymentItem {
  const ref = row.equipmentRequest
    ? { type: "EQUIPMENT_REQUEST" as const, r: row.equipmentRequest }
    : row.supplyOrder
      ? { type: "SUPPLY_ORDER" as const, r: row.supplyOrder }
      : row.serviceRequest
        ? { type: "SERVICE_REQUEST" as const, r: row.serviceRequest }
        : null;
  const out = toPartiesOut({
    id: row.id,
    amount: row.amount,
    status: row.status,
    method: row.method,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    reference: row.reference,
    createdAt: row.createdAt,
  });
  return {
    ...out,
    request: ref
      ? {
          type: ref.type,
          id: ref.r.id,
          number: ref.r.number,
          code: requestCode(ref.type, ref.r.number),
          href: `${REQUEST_PATH[ref.type]}/${ref.r.id}`,
          clientId: ref.r.client.id,
          clientName: ref.r.client.name,
        }
      : null,
    isOverdue: row.status === "DUE" && !!out.dueDate && out.dueDate < day,
  };
}

function filters(query: { status?: "DUE" | "PAID"; overdue?: boolean; requestId?: string }, day: string): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.overdue) and.push(overdueWhere(day));
  if (query.requestId) {
    and.push({ OR: [{ equipmentRequestId: query.requestId }, { supplyOrderId: query.requestId }, { serviceRequestId: query.requestId }] });
  }
  return and.length ? { AND: and } : {};
}

// ======================= Reads =======================

export async function listPayments(query: ListPaymentsData): Promise<PaymentListPage> {
  const day = today();
  const rows = await db.payment.findMany({
    where: filters(query, day),
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    select: paymentSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => toItem(r, day)), nextCursor: page.nextCursor };
}

export async function getPaymentDetail(id: string): Promise<PaymentItem | null> {
  const row = await db.payment.findUnique({ where: { id }, select: paymentSelect });
  return row ? toItem(row, today()) : null;
}

// Totals over the filtered set, from one grouped query (DNSA ch. 20).
export async function getPaymentTotals(query: { status?: "DUE" | "PAID"; overdue?: boolean }): Promise<PaymentTotals> {
  const day = today();
  const where = filters(query, day);
  const [grouped, overdue] = await Promise.all([
    db.payment.groupBy({ by: ["status"], where, _sum: { amount: true } }),
    db.payment.aggregate({ where: { AND: [where, overdueWhere(day)] }, _sum: { amount: true } }),
  ]);
  const of = (s: "DUE" | "PAID") => grouped.find((g) => g.status === s)?._sum.amount ?? 0;
  return { paid: of("PAID"), due: of("DUE"), overdue: overdue._sum.amount ?? 0 };
}

export async function listPaymentsByRequest(type: PayableType, requestId: string): Promise<RequestPayments> {
  const day = today();
  const quoted = await payable(type, requestId, db);
  const rows = await db.payment.findMany({
    where: { [LINK[type]]: requestId },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: paymentSelect,
    take: 100,
  });
  const items = rows.map((r) => toItem(r, day));
  return { items, summary: summarise(quoted?.quotedAmount ?? null, items) };
}

export async function listOverduePayments(limit: number): Promise<PaymentItem[]> {
  const day = today();
  const rows = await db.payment.findMany({
    where: overdueWhere(day),
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: paymentSelect,
    take: limit,
  });
  return rows.map((r) => toItem(r, day));
}

export async function countOverduePayments(): Promise<number> {
  return db.payment.count({ where: overdueWhere() });
}

// ======================= Writes =======================

// PTY-R9, R10, R11.
export async function recordPayment(data: RecordPaymentData): Promise<PaymentRef> {
  return db.$transaction(async (tx) => {
    const request = await payable(data.requestType, data.requestId, tx);
    if (!request) throw Errors.invalid("Choose an existing request.", { requestId: ["Request not found."] });
    if (request.status === "CANCELLED") throw Errors.conflict("This request is cancelled.");
    if (request.quotedAmount !== null) {
      const existing = await sumFor(data.requestType, data.requestId, tx);
      if (existing + data.amount > request.quotedAmount) {
        throw Errors.invalid("Payments would exceed the quoted amount.", { amount: [`At most RWF ${(request.quotedAmount - existing).toLocaleString("en-US")}.`] });
      }
    }
    const paid = data.status === "PAID";
    return tx.payment.create({
      data: {
        [LINK[data.requestType]]: data.requestId,
        amount: data.amount,
        status: data.status,
        method: paid ? data.method : null,
        dueDate: data.dueDate ? toDate(data.dueDate) : null,
        paidAt: paid ? (data.paidAt ? toDate(data.paidAt) : new Date()) : null,
        reference: data.reference,
      },
      select: paymentRefSelect,
    });
  }, SERIALIZABLE);
}

// PTY-R11.
export async function createInstallmentPlan(data: CreateInstallmentPlanData): Promise<{ count: number }> {
  return db.$transaction(async (tx) => {
    const request = await getPayableServiceRequest(data.serviceRequestId, tx);
    if (!request) throw Errors.invalid("Choose an existing service request.", { serviceRequestId: ["Request not found."] });
    if (request.paymentPlan !== "INSTALLMENT") {
      throw Errors.conflict("Set this request's payment plan to Installment first.");
    }
    if (request.quotedAmount === null) {
      throw Errors.conflict("Enter the quoted amount before planning installments.");
    }
    const existing = await sumFor("SERVICE_REQUEST", data.serviceRequestId, tx);
    const planned = sum(data.installments.map((i) => i.amount));
    if (existing + planned !== request.quotedAmount) {
      throw Errors.invalid(
        `Installments must add up to RWF ${(request.quotedAmount - existing).toLocaleString("en-US")} (quoted amount minus payments already recorded).`,
        { installments: ["The total does not match."] },
      );
    }
    const created = await tx.payment.createMany({
      data: data.installments.map((i) => ({
        serviceRequestId: data.serviceRequestId,
        amount: i.amount,
        status: "DUE" as const,
        dueDate: toDate(i.dueDate),
      })),
    });
    return { count: created.count };
  }, SERIALIZABLE);
}

// PTY-R10: DUE → PAID with a method; paidAt set.
export async function markPaymentPaid(data: MarkPaymentPaidData): Promise<PaymentRef> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: data.id, status: "DUE" },
      data: {
        status: "PAID",
        method: data.method,
        reference: data.reference ?? undefined,
        paidAt: data.paidAt ? toDate(data.paidAt) : new Date(),
      },
    });
    if (count === 0) {
      const exists = await tx.payment.findUnique({ where: { id: data.id }, select: { status: true } });
      if (!exists) throw Errors.notFound("Payment");
      throw Errors.conflict("This payment is already paid.");
    }
    return tx.payment.findUniqueOrThrow({ where: { id: data.id }, select: paymentRefSelect });
  });
}

// PTY-R12.
export async function deletePayment({ id }: PaymentIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.payment.deleteMany({ where: { id, status: "DUE" } });
    if (count === 0) {
      const exists = await tx.payment.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw Errors.notFound("Payment");
      throw Errors.conflict("Paid payments cannot be deleted.");
    }
    return { id };
  });
}

// ======================= Helpers (not exported) =======================

function summarise(quotedAmount: number | null, items: PaymentItem[]): PaymentSummary {
  const paid = sum(items.filter((i) => i.status === "PAID").map((i) => i.amount));
  const due = sum(items.filter((i) => i.status === "DUE").map((i) => i.amount));
  const overdue = sum(items.filter((i) => i.isOverdue).map((i) => i.amount));
  return { quotedAmount, paid, due, outstanding: quotedAmount === null ? null : quotedAmount - paid, overdue };
}

async function payable(type: PayableType, id: string, client: DbClient) {
  if (type === "EQUIPMENT_REQUEST") return getPayableEquipmentRequest(id, client);
  if (type === "SUPPLY_ORDER") return getPayableSupplyOrder(id, client);
  return getPayableServiceRequest(id, client);
}

async function sumFor(type: PayableType, requestId: string, client: DbClient): Promise<number> {
  const agg = await client.payment.aggregate({ where: { [LINK[type]]: requestId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}
