// FILE STORAGE ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as storageQueries from "./file-storage.queries";

export const listStoragesRoute = createRoute({ query: storageQueries.listStorages });
export const getStorageRoute = createRoute<{ id: string }>({ query: storageQueries.getStorage });
