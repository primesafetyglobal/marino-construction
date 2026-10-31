// SUPPLY ORDER ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as supplyOrderQueries from "./supply-order.queries";

export const listSupplyOrdersRoute = createRoute({ query: supplyOrderQueries.listSupplyOrders });
export const getSupplyOrderRoute = createRoute<{ id: string }>({ query: supplyOrderQueries.getSupplyOrder });
