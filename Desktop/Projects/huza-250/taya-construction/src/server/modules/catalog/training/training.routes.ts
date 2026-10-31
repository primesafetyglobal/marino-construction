// TRAINING ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as trainingQueries from "./training.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listTrainingsRoute = createRoute({ query: trainingQueries.listTrainings, cacheControl: PUBLIC_CACHE });
export const getTrainingRoute = createRoute<{ id: string }>({ query: trainingQueries.getTraining, cacheControl: PUBLIC_CACHE });
