// REVIEW ROUTES: staff GET handlers, plus the public reviews.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as reviewQueries from "./review.queries";

export const listReviewsRoute = createRoute({ query: reviewQueries.listReviews });
export const getReviewRoute = createRoute<{ id: string }>({ query: reviewQueries.getReview });
export const listPublicReviewsRoute = createRoute({
  query: reviewQueries.getPublicReviews,
  cacheControl: "public, s-maxage=300, stale-while-revalidate=60",
});
