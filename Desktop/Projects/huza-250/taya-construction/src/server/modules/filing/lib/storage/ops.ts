// STORAGE OPERATIONS (guide §4.5). Streaming only; files are never loaded
// fully into memory except small server uploads.

import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FilingError } from "../errors";
import type { LoadedStorage } from "./registry";

type S = Pick<LoadedStorage, "client" | "bucket">;

export type HeadResult = { size: number; contentType: string | null; cacheControl: string | null; contentDisposition: string | null; lastModified: Date | null };

export const isNotFound = (e: unknown) => {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "NotFound" || err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404;
};

const wrap = (e: unknown): never => {
  if (e instanceof FilingError) throw e;
  const msg = (e as Error)?.message ?? "Storage error";
  throw new FilingError("STORAGE_ERROR", `Storage error: ${msg}`);
};

export async function put(s: S, key: string, body: Uint8Array | Buffer | string, contentType: string, cacheControl?: string) {
  const input: PutObjectCommandInput = { Bucket: s.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl };
  await s.client.send(new PutObjectCommand(input)).catch(wrap);
}

export async function head(s: S, key: string): Promise<HeadResult | null> {
  try {
    const h = await s.client.send(new HeadObjectCommand({ Bucket: s.bucket, Key: key }));
    return { size: h.ContentLength ?? 0, contentType: h.ContentType ?? null, cacheControl: h.CacheControl ?? null, contentDisposition: h.ContentDisposition ?? null, lastModified: h.LastModified ?? null };
  } catch (e) {
    if (isNotFound(e)) return null;
    return wrap(e);
  }
}

/** Missing objects are not an error. */
export async function remove(s: S, key: string) {
  try {
    await s.client.send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key }));
  } catch (e) {
    if (!isNotFound(e)) wrap(e);
  }
}

export async function getStream(s: S, key: string) {
  const o = await s.client.send(new GetObjectCommand({ Bucket: s.bucket, Key: key }));
  return {
    body: o.Body as Readable,
    size: o.ContentLength ?? null,
    contentType: o.ContentType ?? undefined,
    cacheControl: o.CacheControl ?? undefined,
    contentDisposition: o.ContentDisposition ?? undefined,
  };
}

export async function presignPut(s: S, key: string, contentType: string, size: number, expiresIn: number) {
  return getSignedUrl(s.client, new PutObjectCommand({ Bucket: s.bucket, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn });
}

export async function presignGet(s: S, key: string, expiresIn: number, downloadName?: string) {
  const disposition = downloadName ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` : undefined;
  return getSignedUrl(s.client, new GetObjectCommand({ Bucket: s.bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn });
}

/** Multipart streaming upload: 8 MB parts, queue 2. Call `.done()`. */
export function uploadStream(s: S, key: string, body: Readable | Buffer, meta: { contentType?: string; cacheControl?: string; contentDisposition?: string } = {}) {
  return new Upload({
    client: s.client,
    params: { Bucket: s.bucket, Key: key, Body: body, ContentType: meta.contentType, CacheControl: meta.cacheControl, ContentDisposition: meta.contentDisposition },
    partSize: 8 * 1024 * 1024,
    queueSize: 2,
  });
}

/** Paginated listing (about 1,000 keys per request); skips "/" placeholders. */
export async function* list(s: S, prefix: string): AsyncGenerator<{ key: string; size: number; lastModified: Date | null }> {
  let token: string | undefined;
  do {
    const res = await s.client.send(new ListObjectsV2Command({ Bucket: s.bucket, Prefix: prefix, ContinuationToken: token })).catch(wrap);
    for (const o of res.Contents ?? []) {
      if (!o.Key || o.Key.endsWith("/")) continue;
      yield { key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? null };
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}

/** Cross-provider copy: stream → multipart upload, metadata preserved, size verified. */
export async function copyBetween(from: S, to: S, key: string): Promise<number> {
  const src = await getStream(from, key);
  await uploadStream(to, key, src.body, { contentType: src.contentType, cacheControl: src.cacheControl, contentDisposition: src.contentDisposition }).done();
  const h = await head(to, key);
  if (!h || (src.size != null && h.size !== src.size)) throw new Error("Copy verification failed");
  return h.size;
}
