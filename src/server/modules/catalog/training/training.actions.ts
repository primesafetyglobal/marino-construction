"use server";
// TRAINING ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { CATALOG_PATHS } from "../catalog.config";
import { createTrainingSchema, trainingIdSchema, updateTrainingSchema } from "./training.schema";
import * as trainingService from "./training.service";

const refresh = () => {
  revalidatePath(CATALOG_PATHS.public, "layout");
};

export const createTraining = createAction({
  access: "training:create",
  schema: createTrainingSchema,
  handler: async ({ input }) => {
    const row = await trainingService.createTraining(input);
    refresh();
    return row;
  },
});

export const updateTraining = createAction({
  access: "training:update",
  schema: updateTrainingSchema,
  handler: async ({ input }) => {
    const row = await trainingService.updateTraining(input);
    refresh();
    return row;
  },
});

export const deleteTraining = createAction({
  access: "training:delete",
  schema: trainingIdSchema,
  handler: async ({ input }) => {
    const row = await trainingService.deleteTraining(input);
    refresh();
    return row;
  },
});
