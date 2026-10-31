// CONTACT CHECK ROUTES (flow).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as contactCheckQueries from "./contact-check.queries";

// Not cached: the answer is about a person.
export const contactCheckRoute = createRoute({ query: contactCheckQueries.checkContact });
