// APPLICANT ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as applicantQueries from "./applicant.queries";

export const listApplicantsRoute = createRoute({ query: applicantQueries.listApplicants });
export const getApplicantRoute = createRoute<{ id: string }>({ query: applicantQueries.getApplicant });
