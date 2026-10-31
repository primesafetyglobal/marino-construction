// FILE SETTINGS ROUTES: GET handlers for client components.

import "server-only";
import { createRoute } from "@/server/core/route";
import * as settingsQueries from "./file-settings.queries";

export const getFileSettingsRoute = createRoute({ query: settingsQueries.getFileSettings });
