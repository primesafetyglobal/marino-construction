// STORAGE REGISTRY (guide §4.3): storages loaded once, the secret decrypted
// once, one S3Client per storage. Cached 5 minutes, invalidated on change.
// This folder (lib/storage/**) is the only place allowed to import @aws-sdk/*.
// No "server-only": scripts and tests import it.

import { S3Client } from "@aws-sdk/client-s3";
import { db } from "@/server/validation/db";
import { decrypt } from "../crypto";
import { FilingError } from "../errors";

export type Access = "PUBLIC" | "PRIVATE";

export type LoadedStorage = {
  id: string;
  name: string;
  endpoint: string | null;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  publicBaseUrl: string | null;
  access: Access;
  isActive: boolean;
  isReadOnly: boolean;
  accessKeyId: string;
  updatedAt: Date;
  client: S3Client;
};

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; byId: Map<string, LoadedStorage> } | null = null;

export const invalidateStorages = () => {
  cache = null;
};

export function makeClient(r: { region: string; endpoint: string | null; forcePathStyle: boolean; accessKeyId: string; secret: string }) {
  return new S3Client({
    region: r.region,
    endpoint: r.endpoint ?? undefined,
    forcePathStyle: r.forcePathStyle,
    maxAttempts: 3,
    credentials: { accessKeyId: r.accessKeyId, secretAccessKey: r.secret },
  });
}

export async function storages(): Promise<Map<string, LoadedStorage>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.byId;
  const rows = await db.fileStorage.findMany({ orderBy: { createdAt: "asc" } });
  const byId = new Map<string, LoadedStorage>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      region: r.region,
      bucket: r.bucket,
      prefix: r.prefix,
      forcePathStyle: r.forcePathStyle,
      publicBaseUrl: r.publicBaseUrl,
      access: r.access,
      isActive: r.isActive,
      isReadOnly: r.isReadOnly,
      accessKeyId: r.accessKeyId,
      updatedAt: r.updatedAt,
      client: makeClient({ region: r.region, endpoint: r.endpoint, forcePathStyle: r.forcePathStyle, accessKeyId: r.accessKeyId, secret: decrypt(r.secretAccessKey) }),
    });
  }
  cache = { at: Date.now(), byId };
  return byId;
}

/** Storages without throwing when the encryption key is missing (status pages). */
export async function storagesOrEmpty(): Promise<Map<string, LoadedStorage>> {
  try {
    return await storages();
  } catch {
    return new Map();
  }
}

export async function getStorage(id: string): Promise<LoadedStorage> {
  const s = (await storages()).get(id);
  if (!s) throw new FilingError("STORAGE_NOT_FOUND", "Storage not found.");
  return s;
}

export async function activeStorage(access: Access): Promise<LoadedStorage> {
  const s = [...(await storagesOrEmpty()).values()].find((x) => x.isActive && x.access === access);
  if (!s) throw new FilingError("STORAGE_NOT_CONFIGURED", `No active ${access.toLowerCase()} storage. Uploads are not configured.`);
  if (s.isReadOnly) throw new FilingError("STORAGE_READ_ONLY", "The active storage is read-only.");
  return s;
}

export async function hasActiveStorage(access: Access): Promise<boolean> {
  return [...(await storagesOrEmpty()).values()].some((x) => x.isActive && !x.isReadOnly && x.access === access);
}
