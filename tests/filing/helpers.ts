// Filing test helpers: storages on the in-memory S3, browser-style uploads, resets.

import { randomBytes } from "node:crypto";
import { vi } from "vitest";
import { db } from "@/server/validation/db";
import { encrypt } from "@/server/modules/filing/lib/crypto";
import { invalidateSettings } from "@/server/modules/filing/lib/settings";
import { invalidateStorages } from "@/server/modules/filing/lib/storage/registry";
import { resetLock } from "@/server/modules/filing/lib/lock";
import { setReferences } from "@/server/modules/filing/lib/references/registry";
import { confirmUpload, invalidateStats, requestUpload } from "@/server/modules/filing/file/file.service";
import { resetStorageTests } from "@/server/modules/filing/file-storage/file-storage.service";
import { resetDb } from "../auth/fixtures";
import { fake, fakeFetch } from "./fake-s3";

export const KEY = randomBytes(32).toString("base64");
export const OLD_KEY = randomBytes(32).toString("base64");

export function filingEnv() {
  process.env.FILING_ENCRYPTION_KEY = KEY;
  process.env.FILING_ENCRYPTION_KEY_ID = "k1";
  delete process.env.FILING_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.FILING_ENCRYPTION_KEY_PREVIOUS_ID;
  process.env.NEXT_PUBLIC_IMAGE_HOSTS = "s3.test";
}

export async function resetFiling() {
  filingEnv();
  await resetDb();
  fake.reset();
  invalidateStorages();
  invalidateSettings();
  invalidateStats();
  resetLock();
  resetStorageTests();
  setReferences(null);
  vi.stubGlobal("fetch", fakeFetch);
}

export const base = (bucket: string) => `https://s3.test/${bucket}`;

export async function makeStorage(o: { bucket: string; name?: string; prefix?: string; access?: "PUBLIC" | "PRIVATE"; active?: boolean; readOnly?: boolean; publicRead?: boolean | ((k: string) => boolean); cors?: boolean; publicBaseUrl?: string | null }) {
  const access = o.access ?? "PUBLIC";
  const prefix = o.prefix ?? "marino";
  if (!fake.buckets.has(o.bucket)) fake.bucket(o.bucket, { publicRead: o.publicRead ?? (access === "PUBLIC" ? (k) => !k.startsWith(`${prefix}/_backups/`) : false), cors: o.cors ?? true });
  const s = await db.fileStorage.create({
    data: {
      name: o.name ?? `Storage ${o.bucket}`,
      endpoint: "https://s3.test",
      region: "us-east-1",
      bucket: o.bucket,
      prefix,
      forcePathStyle: true,
      accessKeyId: "test-key-0001",
      secretAccessKey: encrypt("test-secret"),
      publicBaseUrl: o.publicBaseUrl ?? null,
      access,
      isActive: o.active ?? true,
      isReadOnly: o.readOnly ?? false,
    },
  });
  invalidateStorages();
  return s;
}

/** requestUpload → browser PUT to the presigned URL → confirmUpload. */
export async function browserUpload(name: string, mimeType: string, body: string | Buffer, folder: string | null = null, putType = mimeType) {
  const t = await requestUpload({ name, mimeType, size: Buffer.byteLength(body), folder });
  const res = await fakeFetch(t.uploadUrl, { method: "PUT", headers: { "Content-Type": putType }, body: Buffer.from(body) });
  if (!res.ok) throw new Error(`PUT failed ${res.status}`);
  return { ticket: t, file: await confirmUpload({ key: t.key, storageId: t.storageId, name, folder }) };
}

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png-body")]);
export const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("jpg-body")]);
export const PDF = Buffer.from("%PDF-1.4 test document");
export const blob = (buf: Buffer, type: string) => new Blob([new Uint8Array(buf)], { type });

/** Puts an object straight into a fake bucket (as if uploaded before the module). */
export const seedObject = (bucket: string, key: string, body: string | Buffer = "x", type = "image/png", lastModified?: Date) => fake.put(bucket, key, body, type, lastModified);
