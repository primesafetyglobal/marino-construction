// PAYMENT ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as paymentQueries from "./payment.queries";

export const listPaymentsRoute = createRoute({ query: paymentQueries.listPayments });
export const getPaymentRoute = createRoute<{ id: string }>({ query: paymentQueries.getPayment });
