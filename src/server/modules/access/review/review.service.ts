// REVIEW SERVICE: reviews and feedback; public only when staff approve.
//
// Rules:
// - ACC-R13 rating 1-5; new reviews are NEW; only PUBLIC reviews are public,
//           through the public select; staff only change the status
// - ACC-R14 linked to the client whose phone or email matches
// - ACC-R15 public form: honeypot fake success, Turnstile, rate limit, consent
//
// D-2: imports parties/client findClientIdByContact.

import "server-only";
import { Errors } from "@/server/core/errors";
import { db, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { guardPublicWrite, isBot } from "@/server/validation/public-write";
import type { RequestMeta } from "@/server/validation/request";
import { findClientIdByContact } from "@/server/modules/parties/client/client.service";
import type { ListReviewsData, PublicReviewsData, ReviewIdData, SetReviewStatusData, SubmitReviewData } from "./review.schema";
import {
  reviewAdminSelect,
  reviewPublicSelect,
  reviewRefSelect,
  type ReviewAdmin,
  type ReviewAdminPage,
  type ReviewCounters,
  type ReviewPublic,
  type ReviewPublicPage,
  type ReviewRef,
  type ReviewSummary,
} from "./review.select";

type Division = NonNullable<ReviewPublic["division"]>;

// ACC-R13: the one definition of "public review".
const publicWhere = { status: "PUBLIC" } satisfies Prisma.ReviewWhereInput;

const toPublic = (r: ReviewPublic): ReviewPublic => ({
  id: r.id,
  fullName: r.fullName,
  company: r.company,
  division: r.division,
  rating: r.rating,
  message: r.message,
  createdAt: r.createdAt,
});

// ======================= Reads =======================

export async function listPublicReviews(query: PublicReviewsData): Promise<ReviewPublicPage> {
  const rows = await db.review.findMany({
    where: { ...publicWhere, ...(query.division ? { division: query.division } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: reviewPublicSelect,
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

export async function getReviewSummary(division?: Division): Promise<ReviewSummary> {
  const agg = await db.review.aggregate({
    where: { ...publicWhere, ...(division ? { division } : {}) },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return { average: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10, count: agg._count._all };
}

export async function listReviews(query: ListReviewsData): Promise<ReviewAdminPage> {
  const and: Prisma.ReviewWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.rating) and.push({ rating: query.rating });
  if (query.q) and.push({ OR: [{ fullName: { contains: query.q, mode: "insensitive" } }, { message: { contains: query.q, mode: "insensitive" } }] });
  const rows = await db.review.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: reviewAdminSelect,
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

export function getReviewDetail(id: string): Promise<ReviewAdmin | null> {
  return db.review.findUnique({ where: { id }, select: reviewAdminSelect });
}

export async function countReviews(): Promise<ReviewCounters> {
  return { new: await db.review.count({ where: { status: "NEW" } }) };
}

// ======================= Writes =======================

// PUBLIC (ACC-R13, R14, R15). Saved NEW; the reply reveals nothing.
export async function submitReview(data: SubmitReviewData, meta: RequestMeta): Promise<{ received: true }> {
  if (isBot(data.fax)) return { received: true };
  await guardPublicWrite({ scope: "submit-review", meta, turnstileToken: data.turnstileToken });
  await db.$transaction(async (tx) => {
    const clientId = data.phone || data.email ? await findClientIdByContact({ phone: data.phone, email: data.email }, tx) : null;
    await tx.review.create({
      data: {
        fullName: data.fullName,
        company: data.company,
        phone: data.phone,
        email: data.email,
        clientId,
        division: data.division ?? null,
        rating: data.rating,
        message: data.message,
        status: "NEW",
      },
    });
  });
  return { received: true };
}

// ACC-R13: Public / Private only.
export async function setReviewStatus(data: SetReviewStatusData): Promise<ReviewRef> {
  return db.$transaction(async (tx) => {
    const current = await tx.review.findUnique({ where: { id: data.id }, select: { status: true } });
    if (!current) throw Errors.notFound("Review");
    if (current.status === data.status) throw Errors.conflict(`This review is already ${data.status.toLowerCase()}.`);
    return tx.review.update({ where: { id: data.id }, data: { status: data.status }, select: reviewRefSelect });
  });
}

export async function deleteReview({ id }: ReviewIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.review.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw Errors.notFound("Review");
    await tx.review.delete({ where: { id } });
    return { id };
  });
}
