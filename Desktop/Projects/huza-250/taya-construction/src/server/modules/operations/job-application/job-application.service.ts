// JOB APPLICATION SERVICE: an applicant's application to a published job post.
//
// Rules:
// - OPS-R12 one application per applicant per post (checked here; the
//           @@unique is the safety net); only open posts accept applications
// - OPS-R13 the applicant is found or created by parties (consent, 18+); the
//           public form never changes a saved profile
// - OPS-R16 honeypot fake success, Turnstile, rate limit
// Delete is Admin+ (spam), by access key.
//
// D-2: imports parties/applicant findOrCreateApplicant.

import "server-only";
import { Errors } from "@/server/core/errors";
import { db, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { findOrCreateApplicant } from "@/server/modules/parties/applicant/applicant.service";
import { accessLink } from "../operations.files";
import { requestCode } from "../operations.reference";
import { APPLICATION_MOVES, canMove } from "../operations.status";
import { findOpenJobByNumber } from "../workforce-request/workforce-request.service";
import type { ApplicationIdData, ListApplicationsData, SetApplicationStatusData, SubmitApplicationData } from "./job-application.schema";
import {
  applicationRefSelect,
  applicationSelect,
  type ApplicationItem,
  type ApplicationListPage,
  type ApplicationRef,
} from "./job-application.select";

type Row = Prisma.JobApplicationGetPayload<{ select: typeof applicationSelect }>;

async function toItem(row: Row): Promise<ApplicationItem> {
  const { cvUrl, ...applicant } = row.applicant;
  return {
    ...row,
    applicant: { ...applicant, hasCv: !!cvUrl, cvLink: await accessLink(cvUrl) },
    code: requestCode("WORKFORCE_REQUEST", row.workforceRequest.number),
  };
}

// ======================= Reads =======================

export async function listApplications(query: ListApplicationsData): Promise<ApplicationListPage> {
  const and: Prisma.JobApplicationWhereInput[] = [];
  if (query.workforceRequestId) and.push({ workforceRequestId: query.workforceRequestId });
  if (query.applicantId) and.push({ applicantId: query.applicantId });
  if (query.status) and.push({ status: query.status });
  if (query.q) {
    and.push({
      OR: [
        { applicant: { is: { fullName: { contains: query.q, mode: "insensitive" } } } },
        { applicant: { is: { trade: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }
  const rows = await db.jobApplication.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: applicationSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: await Promise.all(page.items.map(toItem)), nextCursor: page.nextCursor };
}

export async function getApplicationDetail(id: string): Promise<ApplicationItem | null> {
  const row = await db.jobApplication.findUnique({ where: { id }, select: applicationSelect });
  return row ? toItem(row) : null;
}

// ======================= Writes =======================

// PUBLIC (OPS-R12, R13, R16). The reply is { received: true } only.
export async function submitApplication(data: SubmitApplicationData, meta: RequestMeta): Promise<{ received: true }> {
  if (isBot(data.fax)) return { received: true };
  await guardPublicWrite({ scope: "submit-application", meta, turnstileToken: data.turnstileToken });
  await db.$transaction(async (tx) => {
    const job = await findOpenJobByNumber(data.jobNumber, tx);
    if (!job) throw Errors.conflict("This job is no longer open for applications.");
    const applicant = await findOrCreateApplicant(
      {
        returning: data.returning,
        phone: data.phone,
        email: data.email,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender ?? null,
        trade: data.trade,
        experience: data.experience,
        district: data.district,
        cv: data.cv ?? null,
        details: data.details ?? null,
        consent: data.consent,
      },
      tx,
    );
    const already = await tx.jobApplication.findUnique({
      where: { workforceRequestId_applicantId: { workforceRequestId: job.id, applicantId: applicant.id } },
      select: { id: true },
    });
    if (already) throw Errors.conflict("You already applied to this job.");
    await tx.jobApplication.create({ data: { workforceRequestId: job.id, applicantId: applicant.id, message: data.message } });
  });
  return { received: true };
}

export async function setApplicationStatus(data: SetApplicationStatusData): Promise<ApplicationRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.jobApplication.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Application");
    if (current.status !== data.status && !canMove(APPLICATION_MOVES, current.status, data.status)) {
      throw Errors.conflict(`An application cannot move from ${current.status} to ${data.status}.`);
    }
    return tx.jobApplication.update({ where: { id: data.id }, data: { status: data.status, notes: data.notes }, select: applicationRefSelect });
  });
}

export async function deleteApplication({ id }: ApplicationIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.jobApplication.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw Errors.notFound("Application");
    await tx.jobApplication.delete({ where: { id } });
    return { id };
  });
}
