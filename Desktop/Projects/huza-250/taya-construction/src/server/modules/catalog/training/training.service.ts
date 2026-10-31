// TRAINING SERVICE: training cards that link to Prime Safety Global.
//
// Rules:
// - CAT-R1  slug unique
// - CAT-R11 externalUrl is a valid https URL (schema); only published
//           trainings are public
// No enrolment, payment or certificates on Marino. Delete is allowed.

import "server-only";
import { Errors } from "@/server/core/errors";
import { hasPermission, type SessionUser } from "@/server/validation/auth";
import { db, type Prisma } from "@/server/validation/db";
import { pageArgs, toPage } from "@/server/validation/pagination";
import { resolveImage } from "../catalog.files";
import { uniqueSlug } from "../catalog.slug";
import type { CreateTrainingData, ListTrainingsData, TrainingIdData, UpdateTrainingData } from "./training.schema";
import {
  trainingAdminSelect,
  trainingPublicSelect,
  trainingRefSelect,
  type TrainingAdmin,
  type TrainingList,
  type TrainingOne,
  type TrainingPublic,
  type TrainingRef,
} from "./training.select";

type Actor = { actor: SessionUser | null };
type TrainingType = TrainingPublic["type"];

// CAT-R11: the one definition of "public training".
const publicWhere = { isPublished: true } satisfies Prisma.TrainingWhereInput;
const ORDER = [{ isFeatured: "desc" as const }, { title: "asc" as const }, { id: "asc" as const }];

const toPublic = (row: TrainingPublic): TrainingPublic => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  image: row.image,
  type: row.type,
  duration: row.duration,
  externalUrl: row.externalUrl,
  isFeatured: row.isFeatured,
});

function filters(query: ListTrainingsData, staff: boolean): Prisma.TrainingWhereInput {
  const and: Prisma.TrainingWhereInput[] = [];
  if (!staff) and.push(publicWhere);
  else if (query.published !== undefined) and.push({ isPublished: query.published });
  if (query.q) and.push({ OR: [{ title: { contains: query.q, mode: "insensitive" } }, { summary: { contains: query.q, mode: "insensitive" } }] });
  if (query.type) and.push({ type: query.type });
  return and.length ? { AND: and } : {};
}

// ======================= Reads =======================

export async function listTrainings(query: ListTrainingsData, ctx: Actor): Promise<TrainingList> {
  if (hasPermission(ctx.actor, "training:read") && query.view !== "public") return { view: "admin", ...(await listTrainingsAdmin(query)) };
  const rows = await db.training.findMany({ where: filters(query, false), orderBy: ORDER, select: trainingPublicSelect, ...pageArgs(query) });
  const page = toPage(rows, query.limit);
  return { view: "public", items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

export async function listTrainingsAdmin(query: ListTrainingsData) {
  const rows = await db.training.findMany({ where: filters(query, true), orderBy: ORDER, select: trainingAdminSelect, ...pageArgs(query) });
  return toPage(rows, query.limit);
}

export async function getTrainingDetail(id: string, ctx: Actor): Promise<TrainingOne | null> {
  if (hasPermission(ctx.actor, "training:read")) {
    const row = await db.training.findUnique({ where: { id }, select: trainingAdminSelect });
    return row ? { view: "admin", ...row } : null;
  }
  const row = await db.training.findFirst({ where: { id, ...publicWhere }, select: trainingPublicSelect });
  return row ? { view: "public", ...toPublic(row) } : null;
}

export function getTrainingAdmin(id: string): Promise<TrainingAdmin | null> {
  return db.training.findUnique({ where: { id }, select: trainingAdminSelect });
}

export async function listPublishedTrainings(type?: TrainingType): Promise<TrainingPublic[]> {
  const rows = await db.training.findMany({
    where: { ...publicWhere, ...(type ? { type } : {}) },
    orderBy: ORDER,
    select: trainingPublicSelect,
    take: 200,
  });
  return rows.map(toPublic);
}

export async function listFeaturedTrainings(limit: number): Promise<TrainingPublic[]> {
  const rows = await db.training.findMany({
    where: { ...publicWhere, isFeatured: true },
    orderBy: ORDER,
    select: trainingPublicSelect,
    take: limit,
  });
  return rows.map(toPublic);
}

// ======================= Writes =======================

// CAT-R1, R11.
export async function createTraining(data: CreateTrainingData): Promise<TrainingRef> {
  const image = data.image ? await resolveImage(data.image, "training", true) : null;
  return db.$transaction(async (tx) => {
    const slug = await uniqueSlug("training", { wanted: data.slug, from: data.title }, tx);
    return tx.training.create({
      data: {
        title: data.title,
        slug,
        summary: data.summary,
        image,
        type: data.type,
        duration: data.duration,
        externalUrl: data.externalUrl,
        isFeatured: data.isFeatured,
        isPublished: data.isPublished,
      },
      select: trainingRefSelect,
    });
  });
}

export async function updateTraining(data: UpdateTrainingData): Promise<TrainingRef> {
  const image = data.image ? await resolveImage(data.image, "training", true) : data.image;
  return db.$transaction(async (tx) => {
    const current = await tx.training.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!current) throw Errors.notFound("Training");
    const slug = data.slug ? await uniqueSlug("training", { wanted: data.slug, from: data.slug, exceptId: data.id }, tx) : undefined;
    return tx.training.update({
      where: { id: data.id },
      data: {
        title: data.title,
        slug,
        summary: data.summary,
        image,
        type: data.type,
        duration: data.duration,
        externalUrl: data.externalUrl,
        isFeatured: data.isFeatured,
        isPublished: data.isPublished,
      },
      select: trainingRefSelect,
    });
  });
}

export async function deleteTraining({ id }: TrainingIdData): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const current = await tx.training.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw Errors.notFound("Training");
    await tx.training.delete({ where: { id } });
    return { id };
  });
}
