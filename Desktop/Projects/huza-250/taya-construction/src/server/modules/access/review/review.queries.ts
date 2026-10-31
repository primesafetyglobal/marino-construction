// REVIEW QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { Errors } from "@/server/core/errors";
import { createQuery } from "@/server/core/query";
import { getReviewSchema, listReviewsSchema, noInput, publicReviewsSchema, reviewSummarySchema } from "./review.schema";
import * as reviewService from "./review.service";

export const listReviews = createQuery({
  access: "review:read",
  schema: listReviewsSchema,
  handler: ({ input }) => reviewService.listReviews(input),
});

export const getReview = createQuery({
  access: "review:read",
  schema: getReviewSchema,
  onInvalid: "not-found",
  handler: async ({ input }) => {
    const row = await reviewService.getReviewDetail(input.id);
    if (!row) throw Errors.notFound("Review");
    return row;
  },
});

// PUBLIC: PUBLIC reviews only, public select (ACC-R13).
export const getPublicReviews = createQuery({
  access: "public",
  schema: publicReviewsSchema,
  handler: ({ input }) => reviewService.listPublicReviews(input),
});

// PUBLIC: average rating and count of PUBLIC reviews.
export const getReviewSummary = createQuery({
  access: "public",
  schema: reviewSummarySchema,
  handler: ({ input }) => reviewService.getReviewSummary(input.division),
});

// Dashboard and sidebar counter.
export const getReviewCounters = createQuery({
  access: "review:read",
  schema: noInput,
  handler: () => reviewService.countReviews(),
});
