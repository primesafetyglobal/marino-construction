// EQUIPMENT REQUEST ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as equipmentRequestQueries from "./equipment-request.queries";

export const listEquipmentRequestsRoute = createRoute({ query: equipmentRequestQueries.listEquipmentRequests });
export const getEquipmentRequestRoute = createRoute<{ id: string }>({ query: equipmentRequestQueries.getEquipmentRequest });
