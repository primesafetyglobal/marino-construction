// FILE SETTINGS QUERIES: the reads other code may call. Never import this file in a client component.

import "server-only";
import { createQuery } from "@/server/core/query";
import { getSettingsSchema } from "./file-settings.schema";
import * as settingsService from "./file-settings.service";

// The upload dialog needs the limits too: file:create or file-settings:read.
export const getFileSettings = createQuery({
  access: ["file-settings:read", "file:create"],
  schema: getSettingsSchema,
  handler: () => settingsService.readSettings(),
});
