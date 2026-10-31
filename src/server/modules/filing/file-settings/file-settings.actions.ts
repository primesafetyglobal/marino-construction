"use server";
// FILE SETTINGS ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { createAction } from "@/server/core/action";
import { updateSettingsSchema } from "./file-settings.schema";
import * as settingsService from "./file-settings.service";

export const updateFileSettings = createAction({
  access: "file-settings:update",
  schema: updateSettingsSchema,
  handler: ({ input }) => settingsService.updateSettings(input),
});
