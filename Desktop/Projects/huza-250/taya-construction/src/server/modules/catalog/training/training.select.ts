// TRAINING SELECT: which fields may leave the server, and their types.

import type { Prisma } from "@/server/validation/db";
import type { Page } from "@/server/validation/pagination";

export const trainingPublicSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  image: true,
  type: true,
  duration: true,
  externalUrl: true,
  isFeatured: true,
} satisfies Prisma.TrainingSelect;

export const trainingAdminSelect = {
  ...trainingPublicSelect,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TrainingSelect;

export const trainingRefSelect = { id: true, slug: true, title: true } satisfies Prisma.TrainingSelect;

type Row<S extends Prisma.TrainingSelect> = Prisma.TrainingGetPayload<{ select: S }>;
export type TrainingPublic = Row<typeof trainingPublicSelect>;
export type TrainingAdmin = Row<typeof trainingAdminSelect>;
export type TrainingRef = Row<typeof trainingRefSelect>;
export type TrainingList = ({ view: "public" } & Page<TrainingPublic>) | ({ view: "admin" } & Page<TrainingAdmin>);
export type TrainingOne = ({ view: "public" } & TrainingPublic) | ({ view: "admin" } & TrainingAdmin);
