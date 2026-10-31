// TRAINING QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import {
  featuredTrainingsSchema,
  getTrainingSchema,
  listTrainingsSchema,
  publishedTrainingsSchema,
} from "./training.schema";
import * as trainingService from "./training.service";

// PUBLIC: published trainings only (CAT-R11); staff with training:read see all.
export const listTrainings = createQuery({
  access: "public",
  schema: listTrainingsSchema,
  handler: ({ input, user }) => trainingService.listTrainings(input, { actor: user }),
});

// PUBLIC: one training; unpublished ones answer NOT_FOUND to visitors.
export const getTraining = createQuery({
  access: "public",
  schema: getTrainingSchema,
  onInvalid: "not-found",
  handler: async ({ input, user }) => {
    const row = await trainingService.getTrainingDetail(input.id, { actor: user });
    if (!row) throw Errors.notFound("Training");
    return row;
  },
});

// PUBLIC: the Training division page.
export const getPublishedTrainings = createQuery({
  access: "public",
  schema: publishedTrainingsSchema,
  handler: ({ input }) => trainingService.listPublishedTrainings(input.type),
});

// PUBLIC: home page.
export const getFeaturedTrainings = createQuery({
  access: "public",
  schema: featuredTrainingsSchema,
  handler: ({ input }) => trainingService.listFeaturedTrainings(input.limit),
});

export const listTrainingsAdmin = createQuery({
  access: "training:read",
  schema: listTrainingsSchema,
  handler: ({ input }) => trainingService.listTrainingsAdmin(input),
});

export const getTrainingAdmin = createQuery({
  access: "training:read",
  schema: getTrainingSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await trainingService.getTrainingAdmin(input.id);
    if (!row) throw Errors.notFound("Training");
    return row;
  },
});
