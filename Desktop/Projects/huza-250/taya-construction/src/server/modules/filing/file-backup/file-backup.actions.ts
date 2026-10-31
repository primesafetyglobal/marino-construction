"use server";
// FILE BACKUP ACTIONS: the mutations the browser may call.
//
// WARNING: every export in this file is a public endpoint.
// Export only actions built with createAction. No helpers, no reads.

import { createAction } from "@/server/core/action";
import { backupIdSchema, createBackupSchema } from "./file-backup.schema";
import * as backupService from "./file-backup.service";

// Returns at once; the archive is built in the background (Backups tab polls).
export const createBackup = createAction({
  access: "file-backup:create",
  schema: createBackupSchema,
  handler: async ({ input, user }) => {
    const { backup, jobId } = await backupService.createBackup(input, user.id);
    return { backup, jobId };
  },
});

export const deleteBackup = createAction({
  access: "file-backup:delete",
  schema: backupIdSchema,
  handler: ({ input }) => backupService.deleteBackup(input.id),
});
