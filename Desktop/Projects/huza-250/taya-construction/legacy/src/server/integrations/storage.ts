// STORAGE: object storage for uploads (images, CVs, delivery reports).
//
// Contract (DNSA 6.1): browsers upload and download directly with short-lived
// signed URLs; file bytes never pass through the app server. The server
// chooses every key, signs URLs and checks that an object exists (stat).
//
// One implementation: Amazon S3 (or any S3-compatible store), configured by
// S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY. Optional:
// S3_ENDPOINT (R2, MinIO…) and S3_PUBLIC_URL (CDN); by default public files are
// served from https://<bucket>.s3.<region>.amazonaws.com. D-18 (docs/DNSA.md): there is no
// local-disk adapter; without configuration isStorageConfigured() is false,
// upload fields show "Uploads not configured" and every call throws.

import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageAdapter {
  createUploadUrl(args: { key: string; contentType: string; sizeBytes: number; expiresInSeconds: number }): Promise<{
    url: string;
    headers: Record<string, string>;
  }>;
  createDownloadUrl(args: { key: string; fileName: string; expiresInSeconds: number }): Promise<string>;
  stat(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null>;
  delete(key: string): Promise<void>; // missing objects are not an error
  publicUrl(key: string): string;
}

export function isStorageConfigured(): boolean {
  const e = process.env;
  return !!(e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY && (e.S3_REGION || e.S3_ENDPOINT));
}

let client: S3Client | undefined;

function s3(): { client: S3Client; bucket: string } {
  if (!isStorageConfigured()) throw new Error("Storage is not configured: set the S3_* environment variables.");
  client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  return { client, bucket: process.env.S3_BUCKET! };
}

export const storage: StorageAdapter = {
  async createUploadUrl({ key, contentType, sizeBytes, expiresInSeconds }) {
    const { client, bucket } = s3();
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes });
    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return { url, headers: { "Content-Type": contentType } };
  },

  async createDownloadUrl({ key, fileName, expiresInSeconds }) {
    const { client, bucket } = s3();
    const safeName = fileName.replace(/[^\w.-]+/g, "_");
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  },

  async stat(key) {
    const { client, bucket } = s3();
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  },

  async delete(key) {
    const { client, bucket } = s3();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },

  publicUrl(key) {
    return `${storagePublicBase()}/${key}`;
  },
};

// Where public files (catalog images, logos) are read from.
export function storagePublicBase(): string {
  const e = process.env;
  if (e.S3_PUBLIC_URL) return e.S3_PUBLIC_URL.replace(/\/$/, "");
  return `https://${e.S3_BUCKET}.s3.${e.S3_REGION}.amazonaws.com`;
}
