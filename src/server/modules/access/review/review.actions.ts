"use server";
// REVIEW ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/core/action";
import { getRequestMeta } from "@/server/validation/request";
import { ACCESS_PATHS } from "../access.config";
import { reviewIdSchema, setReviewStatusSchema, submitReviewSchema } from "./review.schema";
import * as reviewService from "./review.service";

const refresh = () => {
  revalidatePath(ACCESS_PATHS.reviews, "layout");
  revalidatePath(ACCESS_PATHS.publicReviews);
  revalidatePath(ACCESS_PATHS.home);
};

// PUBLIC: "Share your experience".
// Protection: strict schema with `consent: true`; honeypot `fax` (fake success,
// nothing saved); Turnstile; 5 per minute per hashed IP; saved NEW (never
// public until staff approve); the reply is { received: true } only.
export const submitReview = createAction({
  access: "public",
  schema: submitReviewSchema,
  handler: async ({ input }) => {
    const result = await reviewService.submitReview(input, await getRequestMeta());
    revalidatePath(ACCESS_PATHS.reviews, "layout");
    return result;
  },
});

export const setReviewStatus = createAction({
  access: "review:publish",
  schema: setReviewStatusSchema,
  handler: async ({ input }) => {
    const row = await reviewService.setReviewStatus(input);
    refresh();
    return row;
  },
});

export const deleteReview = createAction({
  access: "review:delete",
  schema: reviewIdSchema,
  handler: async ({ input }) => {
    const row = await reviewService.deleteReview(input);
    refresh();
    return row;
  },
});
