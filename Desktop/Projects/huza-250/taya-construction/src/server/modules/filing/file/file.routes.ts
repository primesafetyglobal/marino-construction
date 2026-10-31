// FILE ROUTES: GET handlers for client components.
// /files/[id]?open=1 or ?download=1 answers with a 302 to the access URL
// (public URL, or a short presigned URL); file bytes never pass through the app.

import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { createRoute } from "@/server/core/route";
import { toActionError } from "@/server/core/result";
import { toSafeError } from "@/server/validation/prisma-errors";
import * as fileQueries from "./file.queries";

export const listFilesRoute = createRoute({ query: fileQueries.listFiles });
export const listFileFoldersRoute = createRoute({ query: fileQueries.listFileFolders });
export const getFileStatsRoute = createRoute({ query: fileQueries.getFileStats });
export const getFileUsageRoute = createRoute<{ id: string }>({ query: fileQueries.getFileUsage });

const getFileJson = createRoute<{ id: string }>({ query: fileQueries.getFile });

const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409 };

export async function getFileRoute(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sp = req.nextUrl.searchParams;
  if (!sp.has("open") && !sp.has("download")) return getFileJson(req, ctx);
  try {
    const { id } = await ctx.params;
    const url = await fileQueries.openFile({ id, download: sp.has("download") ? "1" : undefined });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    unstable_rethrow(err);
    const error = toSafeError(err);
    return NextResponse.json({ ok: false, error: toActionError(error) }, { status: STATUS[error.code] ?? 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
