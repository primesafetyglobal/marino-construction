// EQUIPMENT ROUTES: GET handlers for client components (lists, "load more", staff pickers).

import "server-only";
import { createRoute } from "@/server/core/route";
import * as equipmentQueries from "./equipment.queries";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

export const listEquipmentRoute = createRoute({ query: equipmentQueries.listEquipment, cacheControl: PUBLIC_CACHE });
export const getEquipmentRoute = createRoute<{ id: string }>({ query: equipmentQueries.getEquipment, cacheControl: PUBLIC_CACHE });
