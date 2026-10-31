// CATALOG FILES: upload tickets for catalog images (DNSA ch. 21). Server-only.
//
// One door (Filing guide §14): storage goes through the Filing module. The
// browser asks for a ticket (Filing requestUpload: presigned PUT), uploads
// straight to storage, then sends "upload:<token>" in the form. The token is
// base64url(claims).HMAC-SHA256 signed with a key derived from NEXTAUTH_SECRET;
// it names the Filing key and storage, the folder, the kind and the expiry, so
// an anonymous form can only confirm an upload issued to it. On save, Filing
// confirmUpload registers the file and returns its `url`, the value stored.
// Each module keeps its own copy of this file (DNSA 9.3).

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "@/server/core/errors";
import { confirmUpload, isFilingError, requestUpload } from "@/server/modules/filing/lib";
import { derivedSecret } from "@/server/validation/secrets";
import { CATALOG_CONFIG } from "./catalog.config";
import type { UploadTicket } from "./catalog.select";

export type CatalogUploadKind = "equipment" | "product" | "service" | "training" | "category";

// Filing folders (rules in Files → Settings).
const FOLDERS: Record<CatalogUploadKind, string> = {
  equipment: "equipment",
  product: "products",
  service: "services",
  training: "trainings",
  category: "categories",
};
export const PUBLIC_EQUIPMENT_FOLDER = "equipment-submissions";

type Claims = { k: string; st: string; f: string; p: CatalogUploadKind; n: string; e: number };

const secret = () => derivedSecret("catalog:upload-tickets");

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Filing errors (not configured, type, size) reach the form as field errors.
function asFieldError(e: unknown): never {
  if (isFilingError(e)) {
    if (e.filingCode === "STORAGE_NOT_CONFIGURED" || e.filingCode === "ENCRYPTION_KEY_INVALID") throw Errors.conflict("Uploads are not configured yet.");
    throw Errors.invalid(e.message, { file: [e.message] });
  }
  throw e;
}

export async function createUploadTicket(
  input: { kind: CatalogUploadKind; mimeType: string; sizeBytes: number },
  opts: { folder?: string } = {},
): Promise<UploadTicket> {
  const rules = CATALOG_CONFIG.files.image;
  if (!(rules.allowedMimeTypes as readonly string[]).includes(input.mimeType)) {
    throw Errors.invalid("Use a JPG, PNG or WebP image.", { file: ["Unsupported file type."] });
  }
  if (input.sizeBytes > rules.maxSizeBytes) throw Errors.invalid("The image is larger than 8 MB.", { file: ["Too large."] });
  const folder = opts.folder ?? FOLDERS[input.kind];
  const name = `${input.kind}.${EXT[input.mimeType]}`;
  const t = await requestUpload({ name, mimeType: input.mimeType, size: input.sizeBytes, folder }).catch(asFieldError);
  const exp = Date.now() + CATALOG_CONFIG.files.urlTtlSeconds * 1000 * 4; // the form may be submitted a while after the upload
  const payload = Buffer.from(JSON.stringify({ k: t.key, st: t.storageId, f: folder, p: input.kind, n: name, e: exp } satisfies Claims)).toString("base64url");
  return { uploadUrl: t.uploadUrl, headers: t.headers, uploadToken: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

// Turns "upload:<token>" into the file URL after checking the signature,
// expiry and kind; Filing re-checks the real type and size in storage.
// Other values pass only when `allowUrls` (staff forms): an https URL, which
// keeps a stored file or links an outside image.
export async function resolveImage(ref: string, kind: CatalogUploadKind, allowUrls: boolean): Promise<string> {
  if (!ref.startsWith("upload:")) {
    if (allowUrls && /^https:\/\//.test(ref)) return ref;
    throw Errors.invalid("Please upload the image again.", { images: ["Invalid image."] });
  }
  const [payload, signature] = ref.slice("upload:".length).split(".");
  const fail = () => Errors.invalid("This upload could not be verified. Please upload it again.", { images: ["Upload failed."] });
  if (!payload || !signature) throw fail();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw fail();
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
  if (claims.p !== kind || claims.e < Date.now()) throw fail();
  try {
    const file = await confirmUpload({ key: claims.k, storageId: claims.st, name: claims.n, folder: claims.f });
    return file.url;
  } catch (e) {
    if (isFilingError(e)) throw fail();
    throw e;
  }
}

export async function resolveImages(refs: string[], kind: CatalogUploadKind, allowUrls: boolean): Promise<string[]> {
  return Promise.all(refs.map((r) => resolveImage(r, kind, allowUrls)));
}
