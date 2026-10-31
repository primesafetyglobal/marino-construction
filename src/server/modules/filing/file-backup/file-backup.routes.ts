// FILE BACKUP ROUTES: GET handlers for client components.

import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { createRoute } from "@/server/core/route";
import { toActionError } from "@/server/core/result";
import { toSafeError } from "@/server/validation/prisma-errors";
import * as backupQueries from "./file-backup.queries";

export const listBackupsRoute = createRoute({ query: backupQueries.listBackups });
export const getBackupRoute = createRoute<{ id: string }>({ query: backupQueries.getBackup });
export const getBackupEstimateRoute = createRoute({ query: backupQueries.getBackupEstimate });

const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409 };

export async function downloadBackupRoute(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = await backupQueries.getBackupDownload({ id });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    unstable_rethrow(err);
    const error = toSafeError(err);
    return NextResponse.json({ ok: false, error: toActionError(error) }, { status: STATUS[error.code] ?? 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
