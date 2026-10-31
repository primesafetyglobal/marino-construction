// SERVICE REQUEST SERVICE: service requests; delivered requests form the delivery history.
//
// Rules:
// - OPS-R1  code SR-0001
// - OPS-R2  public requests find or create the client; reply = code only
// - OPS-R3  public: NEW + WEBSITE; staff: existing client + staff source
// - OPS-R4  allowed status moves only; never deleted (cancel)
// - OPS-R8  the linked vendor must be APPROVED
// - OPS-R9  DELIVERED sets deliveredAt in the same transaction
// - OPS-R10 a public request needs an active service
// - OPS-R14 the handler is an active user
// - OPS-R15 staff email after commit
// - OPS-R16 honeypot fake success, Turnstile, rate limit, consent
// - OPS-R17 INSTALLMENT needs a quoted amount before payments are planned
//           (getPayableServiceRequest gives parties both values)
//
// D-2: imports parties/client, parties/vendor, catalog/service (assertPublicService).

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { assertClientExists, findOrCreateClient } from "@/server/modules/parties/client/client.service";
import { assertApprovedVendor } from "@/server/modules/parties/vendor/vendor.service";
import { assertPublicService } from "@/server/modules/catalog/service/service.service";
import { toDateOrNull, toOpsOut } from "../operations.dates";
import { createReportUploadTicket, isPrivateFile, privateLink, resolveReport } from "../operations.files";
import { notifyNewRequest } from "../operations.notify";
import { fakeCode, parseCode, requestCode } from "../operations.reference";
import type { UploadTicket } from "../operations.select";
import { canMove, SERVICE_REQUEST_MOVES } from "../operations.status";
import { assertActiveUser } from "../equipment-request/equipment-request.service";
import type {
  CreateServiceRequestData,
  ListServiceRequestsData,
  SetServiceRequestHandlerData,
  SetServiceRequestStatusData,
  SubmitServiceRequestData,
  UpdateServiceRequestData,
} from "./service-request.schema";
import {
  serviceRequestDetailSelect,
  serviceRequestListSelect,
  serviceRequestRefSelect,
  type ServiceRequestDetail,
  type ServiceRequestListPage,
  type ServiceRequestRef,
} from "./service-request.select";

type Actor = { actor: SessionUser };
const KIND = "SERVICE_REQUEST" as const;
const code = (n: number) => requestCode(KIND, n);

// ======================= Reads =======================

export async function listServiceRequests(query: ListServiceRequestsData, ctx: Actor): Promise<ServiceRequestListPage> {
  const and: Prisma.ServiceRequestWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.service) and.push({ serviceId: query.service });
  if (query.division) and.push({ service: { is: { category: { is: { division: query.division } } } } });
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
        { service: { is: { name: { contains: query.q, mode: "insensitive" } } } },
        { details: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const rows = await db.serviceRequest.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: serviceRequestListSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => ({ ...toOpsOut(r), code: code(r.number) })), nextCursor: page.nextCursor };
}

export async function getServiceRequestDetail(id: string, ctx: Actor): Promise<ServiceRequestDetail | null> {
  const row = await db.serviceRequest.findUnique({ where: { id }, select: serviceRequestDetailSelect });
  if (!row) return null;
  const { deliveryReport, ...rest } = row;
  const canUpdate = hasPermission(ctx.actor, "service-request:update");
  const hasFile = await isPrivateFile(deliveryReport);
  return {
    ...toOpsOut(rest),
    code: code(row.number),
    deliveryReport: {
      text: hasFile ? null : deliveryReport,
      hasFile,
      fileLink: hasFile ? await privateLink(deliveryReport, `report-${code(row.number)}`) : null,
    },
    can: { update: canUpdate, moves: canUpdate ? [...(SERVICE_REQUEST_MOVES[row.status] ?? [])] : [] },
  };
}

// ======================= Writes =======================

// PUBLIC (OPS-R2, R3, R10, R15, R16).
export async function submitServiceRequest(data: SubmitServiceRequestData, meta: RequestMeta): Promise<{ code: string }> {
  if (isBot(data.fax)) return { code: fakeCode(KIND) };
  await guardPublicWrite({ scope: "submit-request", meta, turnstileToken: data.turnstileToken });
  const created = await db.$transaction(async (tx) => {
    const service = await assertPublicService(data.serviceId, { publicOnly: true }, tx);
    const client = await findOrCreateClient(
      { returning: data.returning, phone: data.phone, email: data.email, name: data.name, entityType: data.entityType, companyName: data.companyName, tin: data.tin, district: data.district },
      tx,
    );
    const row = await tx.serviceRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        details: data.details,
        siteLocation: data.siteLocation,
        preferredDate: toDateOrNull(data.preferredDate),
        paymentPlan: data.paymentPlan,
        source: "WEBSITE",
      },
      select: { id: true, number: true, client: { select: { name: true } } },
    });
    return { ...row, serviceName: service.name };
  });
  await notifyNewRequest(KIND, {
    id: created.id,
    number: created.number,
    clientName: created.client.name,
    summary: `${created.serviceName}${data.paymentPlan === "INSTALLMENT" ? " (pay in installments)" : ""}. ${data.details}`,
  }).catch((err) => console.error("[operations] request email failed", err));
  return { code: code(created.number) };
}

// OPS-R3, R8.
export async function createServiceRequest(data: CreateServiceRequestData): Promise<ServiceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    await assertClientExists(data.clientId, tx);
    await assertPublicService(data.serviceId, { publicOnly: false }, tx);
    if (data.vendorId) await assertApprovedVendor(data.vendorId, tx);
    return tx.serviceRequest.create({
      data: {
        clientId: data.clientId,
        serviceId: data.serviceId,
        vendorId: data.vendorId ?? null,
        details: data.details,
        siteLocation: data.siteLocation,
        preferredDate: toDateOrNull(data.preferredDate),
        paymentPlan: data.paymentPlan,
        quotedAmount: data.quotedAmount ?? null,
        notes: data.notes,
        source: data.source,
      },
      select: serviceRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R8.
export async function updateServiceRequest(data: UpdateServiceRequestData): Promise<ServiceRequestRef> {
  const deliveryReport = data.deliveryReport !== undefined ? await resolveReport(data.deliveryReport) : undefined;
  const row = await db.$transaction(async (tx) => {
    const current = await tx.serviceRequest.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!current) throw Errors.notFound("Request");
    if (data.vendorId) await assertApprovedVendor(data.vendorId, tx);
    return tx.serviceRequest.update({
      where: { id: data.id },
      data: {
        vendorId: data.vendorId,
        details: data.details,
        siteLocation: data.siteLocation,
        preferredDate: data.preferredDate !== undefined ? toDateOrNull(data.preferredDate) : undefined,
        quotedAmount: data.quotedAmount,
        paymentPlan: data.paymentPlan,
        deliveryReport,
        notes: data.notes,
      },
      select: serviceRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R4, R9.
export async function setServiceRequestStatus(data: SetServiceRequestStatusData): Promise<ServiceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.serviceRequest.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Request");
    if (!canMove(SERVICE_REQUEST_MOVES, current.status, data.status)) throw Errors.conflict(`A request cannot move from ${current.status} to ${data.status}.`);
    const { count } = await tx.serviceRequest.updateMany({
      where: { id: data.id, status: current.status },
      data: { status: data.status, ...(data.status === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
    });
    if (count === 0) throw Errors.conflict("This request was changed by someone else. Reload and try again.");
    return tx.serviceRequest.findUniqueOrThrow({ where: { id: data.id }, select: serviceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R14.
export async function setServiceRequestHandler(data: SetServiceRequestHandlerData): Promise<ServiceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    if (data.handledById) await assertActiveUser(data.handledById, tx);
    const exists = await tx.serviceRequest.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!exists) throw Errors.notFound("Request");
    return tx.serviceRequest.update({ where: { id: data.id }, data: { handledById: data.handledById }, select: serviceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// Staff upload ticket for a delivery report (inspection report, photos).
export function createDeliveryReportUploadTicket(data: { mimeType: string; sizeBytes: number }): Promise<UploadTicket> {
  return createReportUploadTicket(data);
}

// ======================= Shared with other modules (D-2) =======================

// Parties (payments, OPS-R17): the request exists, its quoted amount and plan.
export async function getPayableServiceRequest(id: string, client: DbClient) {
  return client.serviceRequest.findUnique({ where: { id }, select: { id: true, quotedAmount: true, paymentPlan: true, status: true } });
}
