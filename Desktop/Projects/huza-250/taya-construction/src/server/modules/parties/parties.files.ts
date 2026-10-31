// PARTIES FILES: upload tickets for CVs (private) and vendor logos (public). Server-only.
//
// Same flow as catalog.files.ts, own copy on purpose (DNSA 9.3), signed with
// a key derived from NEXTAUTH_SECRET. One door: storage goes through the Filing
// module. Both are stored as the Filing `url`; CVs live in the PRIVATE folder
// "cvs" and are opened through 5-minute presigned links (getAccessUrl) after
// the caller's own access check. Logos are public URLs.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "@/server/core/errors";
import { confirmUpload, getAccessUrl, isFilingError, requestUpload } from "@/server/modules/filing/lib";
import { derivedSecret } from "@/server/validation/secrets";
import { PARTIES_CONFIG } from "./parties.config";
import type { UploadTicket } from "./parties.select";

export type PartiesUploadKind = "cv" | "logo";
type Claims = { k: string; st: string; f: string; p: PartiesUploadKind; n: string; e: number };

// Filing folders (rules in Files → Settings; "cvs" is PRIVATE).
const FOLDERS: Record<PartiesUploadKind, string> = { cv: "cvs", logo: "vendor-logos" };

const secret = () => derivedSecret("parties:upload-tickets");

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function asFieldError(e: unknown): never {
  if (isFilingError(e)) {
    if (e.filingCode === "STORAGE_NOT_CONFIGURED" || e.filingCode === "ENCRYPTION_KEY_INVALID") throw Errors.conflict("Uploads are not configured yet.");
    throw Errors.invalid(e.message, { file: [e.message] });
  }
  throw e;
}

export async function createUploadTicket(input: { kind: PartiesUploadKind; mimeType: string; sizeBytes: number }): Promise<UploadTicket> {
  const rules = PARTIES_CONFIG.files[input.kind];
  if (!(rules.allowedMimeTypes as readonly string[]).includes(input.mimeType)) {
    throw Errors.invalid(input.kind === "cv" ? "Upload your CV as a PDF." : "Use a JPG, PNG, WebP or SVG logo.", { file: ["Unsupported file type."] });
  }
  if (input.sizeBytes > rules.maxSizeBytes) {
    throw Errors.invalid(`The file is larger than ${Math.round(rules.maxSizeBytes / 1024 / 1024)} MB.`, { file: ["Too large."] });
  }
  const folder = FOLDERS[input.kind];
  const name = `${input.kind}.${EXT[input.mimeType]}`;
  const t = await requestUpload({ name, mimeType: input.mimeType, size: input.sizeBytes, folder }).catch(asFieldError);
  const exp = Date.now() + PARTIES_CONFIG.files.urlTtlSeconds * 1000 * 4;
  const payload = Buffer.from(JSON.stringify({ k: t.key, st: t.storageId, f: folder, p: input.kind, n: name, e: exp } satisfies Claims)).toString("base64url");
  return { uploadUrl: t.uploadUrl, headers: t.headers, uploadToken: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

// "upload:<token>" → the Filing `url` stored in the column. Staff may also keep
// or paste an https URL (an unchanged stored file, or an outside link).
export async function resolveUpload(ref: string, kind: PartiesUploadKind, allowUrls: boolean): Promise<string> {
  const field = kind === "cv" ? "cvUrl" : "logo";
  if (!ref.startsWith("upload:")) {
    if (allowUrls && /^https:\/\//.test(ref)) return ref;
    throw Errors.invalid("Please upload the file again.", { [field]: ["Invalid file."] });
  }
  const [payload, signature] = ref.slice("upload:".length).split(".");
  const fail = () => Errors.invalid("This upload could not be verified. Please upload it again.", { [field]: ["Upload failed."] });
  if (!payload || !signature) throw fail();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw fail();
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
  if (claims.p !== kind || claims.e < Date.now()) throw fail();
  try {
    return (await confirmUpload({ key: claims.k, storageId: claims.st, name: claims.n, folder: claims.f })).url;
  } catch (e) {
    if (isFilingError(e)) throw fail();
    throw e;
  }
}

// A link to open a stored file: a short presigned download for private files,
// the URL itself for public or outside files, null for deleted ones.
// Call only after the caller's own access check.
export async function fileLink(stored: string | null, fileName: string): Promise<string | null> {
  if (!stored) return null;
  void fileName; // Filing names the download after the registered file
  return getAccessUrl(stored, { download: true }).catch(() => null);
}
