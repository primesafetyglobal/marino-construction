// WORKFORCE REQUEST SERVICE: client staffing needs, published as job posts.
//
// Rules:
// - OPS-R1  code WR-0001
// - OPS-R2  public requests find or create the client; reply = code only
// - OPS-R3  public: NEW + WEBSITE; staff: existing client + staff source
// - OPS-R4  allowed status moves only; never deleted (CLOSED)
// - OPS-R11 publishing needs a job description and moves NEW to RECRUITING;
//           a post is public only when published, RECRUITING and before its
//           deadline; client data is never in the job select
// - OPS-R14 the handler is an active user
// - OPS-R15 staff email after commit
// - OPS-R16 honeypot fake success, Turnstile, rate limit, consent

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type DbClient, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { assertClientExists, findOrCreateClient } from "@/server/modules/parties/client/client.service";
import { OPS_CONFIG } from "../operations.config";
import { toDate, toDateOnly, toDateOrNull, today, toOpsOut } from "../operations.dates";
import { notifyNewRequest } from "../operations.notify";
import { fakeCode, parseCode, requestCode } from "../operations.reference";
import { canMove, WORKFORCE_REQUEST_MOVES } from "../operations.status";
import { assertActiveUser } from "../equipment-request/equipment-request.service";
import type {
  CreateWorkforceRequestData,
  ListJobsData,
  ListWorkforceRequestsData,
  PublishJobData,
  SetWorkforceRequestHandlerData,
  SetWorkforceRequestStatusData,
  SubmitWorkforceRequestData,
  UpdateWorkforceRequestData,
  WorkforceRequestIdData,
} from "./workforce-request.schema";
import {
  jobPublicSelect,
  workforceRequestDetailSelect,
  workforceRequestListSelect,
  workforceRequestRefSelect,
  type JobPage,
  type JobPost,
  type WorkforceRequestDetail,
  type WorkforceRequestListPage,
  type WorkforceRequestRef,
} from "./workforce-request.select";

type Actor = { actor: SessionUser };
const KIND = "WORKFORCE_REQUEST" as const;
const code = (n: number) => requestCode(KIND, n);

// OPS-R11: the one definition of an open job post. The deadline day is still open.
export function openJobWhere(day = today()): Prisma.WorkforceRequestWhereInput {
  return { isPublished: true, status: "RECRUITING", OR: [{ deadline: null }, { deadline: { gte: toDate(day) } }] };
}

const isOpen = (r: { isPublished: boolean; status: string; deadline: Date | null }, day: string) =>
  r.isPublished && r.status === "RECRUITING" && (!r.deadline || toDateOnly(r.deadline) >= day);

// "Kicukiro, Kigali" → "Kigali": job posts show the district only.
const districtOf = (location: string) => location.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? location;

// OPS-R11: built field by field from the job select.
function toJob(row: Prisma.WorkforceRequestGetPayload<{ select: typeof jobPublicSelect }>): JobPost {
  return {
    number: row.number,
    code: code(row.number),
    role: row.role,
    quantity: row.quantity,
    duration: row.duration,
    district: districtOf(row.siteLocation),
    startDate: row.startDate ? toDateOnly(row.startDate) : null,
    jobDescription: row.jobDescription,
    deadline: row.deadline ? toDateOnly(row.deadline) : null,
  };
}

// ======================= Reads =======================

export async function listWorkforceRequests(query: ListWorkforceRequestsData, ctx: Actor): Promise<WorkforceRequestListPage> {
  const day = today();
  const and: Prisma.WorkforceRequestWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.published !== undefined) and.push({ isPublished: query.published });
  if (query.clientId) and.push({ clientId: query.clientId });
  if (query.handler === "me") and.push({ handledById: ctx.actor.id });
  else if (query.handler === "none") and.push({ handledById: null });
  else if (query.handler) and.push({ handledById: query.handler });
  if (query.q) {
    const parsed = parseCode(query.q);
    and.push({
      OR: [
        ...(parsed?.kind === KIND ? [{ number: parsed.number }] : /^\d+$/.test(query.q) ? [{ number: Number(query.q) }] : []),
        { role: { contains: query.q, mode: "insensitive" } },
        { client: { is: { name: { contains: query.q, mode: "insensitive" } } } },
        { client: { is: { companyName: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }
  const rows = await db.workforceRequest.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: workforceRequestListSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => ({ ...toOpsOut(r), code: code(r.number), isOpen: isOpen(r, day) })), nextCursor: page.nextCursor };
}

export async function getWorkforceRequestDetail(id: string, ctx: Actor): Promise<WorkforceRequestDetail | null> {
  const row = await db.workforceRequest.findUnique({ where: { id }, select: workforceRequestDetailSelect });
  if (!row) return null;
  const canUpdate = hasPermission(ctx.actor, "workforce-request:update");
  return {
    ...toOpsOut(row),
    code: code(row.number),
    isOpen: isOpen(row, today()),
    can: {
      update: canUpdate,
      moves: canUpdate ? [...(WORKFORCE_REQUEST_MOVES[row.status] ?? [])] : [],
      publish: hasPermission(ctx.actor, "workforce-request:publish"),
    },
  };
}

// OPS-R11: public job posts.
export async function listOpenJobs(query: ListJobsData): Promise<JobPage> {
  const rows = await db.workforceRequest.findMany({
    where: openJobWhere(),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: jobPublicSelect,
    ...pageArgs({ cursor: query.cursor, limit: Math.min(query.limit, OPS_CONFIG.openJobsLimit) }),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map((r) => ({ id: r.id, ...toJob(r) })), nextCursor: page.nextCursor };
}

// OPS-R11: a closed, unpublished or unknown number is simply not found.
export async function getOpenJob(number: number): Promise<JobPost | null> {
  const row = await db.workforceRequest.findFirst({ where: { number, ...openJobWhere() }, select: jobPublicSelect });
  return row ? toJob(row) : null;
}

export async function countOpenJobs(): Promise<number> {
  return db.workforceRequest.count({ where: openJobWhere() });
}

// ======================= Writes =======================

// PUBLIC (OPS-R2, R3, R15, R16).
export async function submitWorkforceRequest(data: SubmitWorkforceRequestData, meta: RequestMeta): Promise<{ code: string }> {
  if (isBot(data.fax)) return { code: fakeCode(KIND) };
  await guardPublicWrite({ scope: "submit-request", meta, turnstileToken: data.turnstileToken });
  const created = await db.$transaction(async (tx) => {
    const client = await findOrCreateClient(
      { returning: data.returning, phone: data.phone, email: data.email, name: data.name, entityType: data.entityType, companyName: data.companyName, tin: data.tin, district: data.district },
      tx,
    );
    return tx.workforceRequest.create({
      data: {
        clientId: client.id,
        role: data.role,
        quantity: data.quantity,
        duration: data.duration,
        siteLocation: data.siteLocation,
        startDate: toDateOrNull(data.startDate),
        details: data.details,
        source: "WEBSITE",
      },
      select: { id: true, number: true, client: { select: { name: true } } },
    });
  });
  await notifyNewRequest(KIND, {
    id: created.id,
    number: created.number,
    clientName: created.client.name,
    summary: `${data.quantity} × ${data.role}, ${data.duration}, at ${data.siteLocation}.`,
  }).catch((err) => console.error("[operations] request email failed", err));
  return { code: code(created.number) };
}

export async function createWorkforceRequest(data: CreateWorkforceRequestData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    await assertClientExists(data.clientId, tx);
    return tx.workforceRequest.create({
      data: {
        clientId: data.clientId,
        role: data.role,
        quantity: data.quantity,
        duration: data.duration,
        siteLocation: data.siteLocation,
        startDate: toDateOrNull(data.startDate),
        details: data.details,
        notes: data.notes,
        source: data.source,
      },
      select: workforceRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R11: a published post keeps a job description.
export async function updateWorkforceRequest(data: UpdateWorkforceRequestData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.workforceRequest.findUnique({ where: { id: data.id }, select: { isPublished: true } });
    if (!current) throw Errors.notFound("Request");
    if (current.isPublished && data.jobDescription === null) throw Errors.invalid("A published job needs a description.", { jobDescription: ["Required while published."] });
    return tx.workforceRequest.update({
      where: { id: data.id },
      data: {
        role: data.role,
        quantity: data.quantity,
        duration: data.duration,
        siteLocation: data.siteLocation,
        startDate: data.startDate !== undefined ? toDateOrNull(data.startDate) : undefined,
        details: data.details,
        jobDescription: data.jobDescription,
        deadline: data.deadline !== undefined ? toDateOrNull(data.deadline) : undefined,
        notes: data.notes,
      },
      select: workforceRequestRefSelect,
    });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R11.
export async function publishJob(data: PublishJobData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.workforceRequest.findUnique({ where: { id: data.id }, select: { status: true, jobDescription: true } });
    if (!current) throw Errors.notFound("Request");
    if (current.status === "FILLED" || current.status === "CLOSED") throw Errors.conflict("This request is filled or closed. Reopen it first.");
    const description = data.jobDescription !== undefined ? data.jobDescription : current.jobDescription;
    if (!description) throw Errors.invalid("Write a job description before publishing.", { jobDescription: ["Required to publish."] });
    if (data.deadline && data.deadline < today()) throw Errors.invalid("The deadline has already passed.", { deadline: ["Choose a future date."] });
    const { count } = await tx.workforceRequest.updateMany({
      where: { id: data.id, status: current.status },
      data: {
        isPublished: true,
        jobDescription: description,
        ...(data.deadline !== undefined ? { deadline: toDateOrNull(data.deadline) } : {}),
        ...(current.status === "NEW" ? { status: "RECRUITING" } : {}),
      },
    });
    if (count === 0) throw Errors.conflict("This request was changed by someone else. Reload and try again.");
    return tx.workforceRequest.findUniqueOrThrow({ where: { id: data.id }, select: workforceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

export async function unpublishJob({ id }: WorkforceRequestIdData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.workforceRequest.findUnique({ where: { id }, select: { isPublished: true } });
    if (!current) throw Errors.notFound("Request");
    if (!current.isPublished) throw Errors.conflict("This job is not published.");
    return tx.workforceRequest.update({ where: { id }, data: { isPublished: false }, select: workforceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R4 (FILLED / CLOSED hide the post through openJobWhere).
export async function setWorkforceRequestStatus(data: SetWorkforceRequestStatusData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.workforceRequest.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Request");
    if (!canMove(WORKFORCE_REQUEST_MOVES, current.status, data.status)) throw Errors.conflict(`A request cannot move from ${current.status} to ${data.status}.`);
    const { count } = await tx.workforceRequest.updateMany({ where: { id: data.id, status: current.status }, data: { status: data.status } });
    if (count === 0) throw Errors.conflict("This request was changed by someone else. Reload and try again.");
    return tx.workforceRequest.findUniqueOrThrow({ where: { id: data.id }, select: workforceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// OPS-R14.
export async function setWorkforceRequestHandler(data: SetWorkforceRequestHandlerData): Promise<WorkforceRequestRef> {
  const row = await db.$transaction(async (tx) => {
    if (data.handledById) await assertActiveUser(data.handledById, tx);
    const exists = await tx.workforceRequest.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!exists) throw Errors.notFound("Request");
    return tx.workforceRequest.update({ where: { id: data.id }, data: { handledById: data.handledById }, select: workforceRequestRefSelect });
  });
  return { ...row, code: code(row.number) };
}

// ======================= Shared with other services (operations only) =======================

// OPS-R12: job-application takes the open post inside its transaction.
export async function findOpenJobByNumber(number: number, client: DbClient) {
  return client.workforceRequest.findFirst({ where: { number, ...openJobWhere() }, select: { id: true, number: true, role: true } });
}
