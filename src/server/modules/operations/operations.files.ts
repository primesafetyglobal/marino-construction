// OPERATIONS FILES: delivery report uploads and private file links. Server-only.
// Own copy of the ticket code on purpose (DNSA 9.3), signed with a key derived
// from NEXTAUTH_SECRET. One door: storage goes through the Filing module.
// Reports live in the PRIVATE folder "delivery-reports" and are stored as the
// Filing `url`; they are opened through presigned links (getAccessUrl).

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "@/server/core/errors";
import { confirmUpload, getAccessUrl, getFileByUrl, isFilingError, requestUpload } from "@/server/modules/filing/lib";
import { derivedSecret } from "@/server/validation/secrets";
import { OPS_CONFIG } from "./operations.config";
import type { UploadTicket } from "./operations.select";

type Claims = { k: string; st: string; f: string; p: "report"; n: string; e: number };

const FOLDER = "delivery-reports";

const secret = () => derivedSecret("operations:upload-tickets");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function createReportUploadTicket(input: { mimeType: string; sizeBytes: number }): Promise<UploadTicket> {
  const rules = OPS_CONFIG.files.report;
  if (!(rules.allowedMimeTypes as readonly string[]).includes(input.mimeType)) throw Errors.invalid("Use a PDF, JPG or PNG file.", { file: ["Unsupported file type."] });
  if (input.sizeBytes > rules.maxSizeBytes) throw Errors.invalid("The file is larger than 10 MB.", { file: ["Too large."] });
  const name = `report.${EXT[input.mimeType]}`;
  const t = await requestUpload({ name, mimeType: input.mimeType, size: input.sizeBytes, folder: FOLDER }).catch((e) => {
    if (isFilingError(e)) {
      if (e.filingCode === "STORAGE_NOT_CONFIGURED" || e.filingCode === "ENCRYPTION_KEY_INVALID") throw Errors.conflict("Uploads are not configured yet.");
      throw Errors.invalid(e.message, { file: [e.message] });
    }
    throw e;
  });
  const exp = Date.now() + OPS_CONFIG.files.urlTtlSeconds * 1000 * 4;
  const payload = Buffer.from(JSON.stringify({ k: t.key, st: t.storageId, f: FOLDER, p: "report", n: name, e: exp } satisfies Claims)).toString("base64url");
  return { uploadUrl: t.uploadUrl, headers: t.headers, uploadToken: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

// "upload:<token>" → the Filing `url`; any other text is kept as the report text.
export async function resolveReport(value: string | null): Promise<string | null> {
  if (!value || !value.startsWith("upload:")) return value;
  const [payload, signature] = value.slice("upload:".length).split(".");
  const fail = () => Errors.invalid("This upload could not be verified. Please upload it again.", { deliveryReport: ["Upload failed."] });
  if (!payload || !signature) throw fail();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw fail();
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
  if (claims.p !== "report" || claims.e < Date.now()) throw fail();
  try {
    return (await confirmUpload({ key: claims.k, storageId: claims.st, name: claims.n, folder: claims.f })).url;
  } catch (e) {
    if (isFilingError(e)) throw fail();
    throw e;
  }
}

// A short-lived link for a stored private file (report, CV), or null.
// Call only after the caller's own access check.
export async function privateLink(stored: string | null, fileName: string): Promise<string | null> {
  if (!stored) return null;
  void fileName; // Filing names the download after the registered file
  if (!(await isPrivateFile(stored))) return null;
  return getAccessUrl(stored, { download: true }).catch(() => null);
}

// A link to open a stored file URL (CV): presigned for private files, the URL
// itself for public or outside files, null when deleted. After the access check.
export async function accessLink(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  return getAccessUrl(stored, { download: true }).catch(() => null);
}

// A registered file (the delivery report column holds either text or a file URL).
export const isPrivateFile = async (stored: string | null) => !!stored && !!(await getFileByUrl(stored).catch(() => null));
