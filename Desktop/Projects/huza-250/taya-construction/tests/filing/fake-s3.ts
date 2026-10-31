// In-memory S3 for the Filing tests (Docker / MinIO are not available here).
// Replaces S3Client.send, lib-storage Upload, the presigner and fetch. Buckets
// are keyed by name. Anonymous URLs use path style: https://s3.test/<bucket>/<key>;
// presigned URLs: https://signed.s3.test/<bucket>/<key>?X-Amz-...

import { Readable } from "node:stream";

export type FakeObject = { body: Buffer; contentType?: string; cacheControl?: string; contentDisposition?: string; lastModified: Date };
export type FakeBucket = {
  objects: Map<string, FakeObject>;
  publicRead: (key: string) => boolean;
  cors: boolean;
};

type Hook = (op: string, bucket: string, key: string) => void | Promise<void>;

export const fake = {
  buckets: new Map<string, FakeBucket>(),
  cdn: new Map<string, string>(), // base → bucket
  clockSkewMs: 0,
  failDelete: new Set<string>(),
  calls: [] as { op: string; bucket: string; key: string }[],
  hook: null as Hook | null,
  reset() {
    this.buckets.clear();
    this.cdn.clear();
    this.clockSkewMs = 0;
    this.failDelete.clear();
    this.calls = [];
    this.hook = null;
  },
  bucket(name: string, opts: { publicRead?: boolean | ((key: string) => boolean); cors?: boolean } = {}) {
    const pr = opts.publicRead ?? false;
    const b: FakeBucket = { objects: new Map(), publicRead: typeof pr === "function" ? pr : () => pr, cors: opts.cors ?? true };
    this.buckets.set(name, b);
    return b;
  },
  get(bucket: string, key: string) {
    return this.buckets.get(bucket)?.objects.get(key) ?? null;
  },
  put(bucket: string, key: string, body: string | Buffer, contentType = "application/octet-stream", lastModified = new Date()) {
    this.buckets.get(bucket)!.objects.set(key, { body: Buffer.from(body), contentType, lastModified });
  },
  count(op: string, bucket?: string, key?: string) {
    return this.calls.filter((c) => c.op === op && (!bucket || c.bucket === bucket) && (!key || c.key === key)).length;
  },
};

const err = (name: string, status: number, message = name) => Object.assign(new Error(message), { name, $metadata: { httpStatusCode: status } });

async function toBuffer(body: unknown): Promise<Buffer> {
  if (body == null) return Buffer.alloc(0);
  if (typeof body === "string") return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof (body as Blob).arrayBuffer === "function") return Buffer.from(await (body as Blob).arrayBuffer());
  const chunks: Buffer[] = [];
  for await (const c of body as AsyncIterable<Buffer | string>) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

function bucketOf(name: string) {
  const b = fake.buckets.get(name);
  if (!b) throw err("NoSuchBucket", 404);
  return b;
}

export class FakeS3Client {
  config: { region?: string; endpoint?: string; forcePathStyle?: boolean; credentials: { accessKeyId: string; secretAccessKey: string } };
  constructor(config: FakeS3Client["config"]) {
    this.config = config;
  }
  destroy() {}
  async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }): Promise<Record<string, unknown>> {
    if (this.config.credentials.accessKeyId === "bad-key") throw err("InvalidAccessKeyId", 403, "The AWS Access Key Id you provided does not exist.");
    const op = cmd.constructor.name.replace(/Command$/, "");
    const input = cmd.input;
    const bucket = String(input.Bucket);
    const key = String(input.Key ?? input.Prefix ?? "");
    fake.calls.push({ op, bucket, key });
    if (fake.hook) await fake.hook(op, bucket, key);
    const b = bucketOf(bucket);
    switch (op) {
      case "PutObject":
        b.objects.set(key, {
          body: await toBuffer(input.Body),
          contentType: input.ContentType as string | undefined,
          cacheControl: input.CacheControl as string | undefined,
          contentDisposition: input.ContentDisposition as string | undefined,
          lastModified: new Date(),
        });
        return {};
      case "HeadObject": {
        const o = b.objects.get(key);
        if (!o) throw err("NotFound", 404);
        return { ContentLength: o.body.length, ContentType: o.contentType, CacheControl: o.cacheControl, ContentDisposition: o.contentDisposition, LastModified: o.lastModified };
      }
      case "GetObject": {
        const o = b.objects.get(key);
        if (!o) throw err("NoSuchKey", 404);
        const stream = Readable.from([o.body]) as Readable & { transformToString: () => Promise<string> };
        stream.transformToString = async () => o.body.toString("utf8");
        return { Body: stream, ContentLength: o.body.length, ContentType: o.contentType, CacheControl: o.cacheControl, ContentDisposition: o.contentDisposition };
      }
      case "DeleteObject":
        if (fake.failDelete.has(key)) throw err("InternalError", 500, "Delete failed (test)");
        b.objects.delete(key);
        return {};
      case "ListObjectsV2": {
        const all = [...b.objects.keys()].filter((k) => k.startsWith(key)).sort();
        const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
        const page = all.slice(start, start + 1000);
        const truncated = start + 1000 < all.length;
        return {
          Contents: page.map((k) => ({ Key: k, Size: b.objects.get(k)!.body.length, LastModified: b.objects.get(k)!.lastModified })),
          IsTruncated: truncated,
          NextContinuationToken: truncated ? String(start + 1000) : undefined,
        };
      }
      default:
        throw new Error(`Fake S3: unsupported ${op}`);
    }
  }
}

export class FakeUpload {
  private aborted = false;
  constructor(private opts: { client: FakeS3Client; params: Record<string, unknown> }) {}
  async done() {
    const body = await toBuffer(this.opts.params.Body);
    if (this.aborted) throw err("AbortError", 499, "Upload aborted");
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await this.opts.client.send(new PutObjectCommand({ ...(this.opts.params as object), Body: body } as never) as never);
    return {};
  }
  async abort() {
    this.aborted = true;
  }
}

const enc = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export async function fakeGetSignedUrl(client: FakeS3Client, cmd: { constructor: { name: string }; input: Record<string, unknown> }, opts: { expiresIn?: number }) {
  if (client.config.credentials.accessKeyId === "bad-key") throw err("InvalidAccessKeyId", 403);
  const op = cmd.constructor.name.replace(/ObjectCommand$/, "");
  const q = new URLSearchParams({ "X-Amz-Expires": String(opts.expiresIn ?? 900), "X-Amz-Signature": Math.random().toString(36).slice(2), op });
  if (cmd.input.ContentType) q.set("ct", String(cmd.input.ContentType));
  if (cmd.input.ResponseContentDisposition) q.set("response-content-disposition", String(cmd.input.ResponseContentDisposition));
  return `https://signed.s3.test/${cmd.input.Bucket}/${enc(String(cmd.input.Key))}?${q}`;
}

const resp = (status: number, body: BodyInit | null = null, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { date: new Date(Date.now() + fake.clockSkewMs).toUTCString(), ...headers } });

export async function fakeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  let bucketName: string;
  let key: string;
  if (url.host === "signed.s3.test" || url.host === "s3.test") {
    const [, b, ...rest] = url.pathname.split("/");
    bucketName = b;
    key = rest.map(decodeURIComponent).join("/");
  } else {
    const base = [...fake.cdn.keys()].find((c) => url.href.startsWith(c + "/"));
    if (!base) return resp(404);
    bucketName = fake.cdn.get(base)!;
    key = url.href.slice(base.length + 1).split("?")[0].split("/").map(decodeURIComponent).join("/");
  }
  const b = fake.buckets.get(bucketName);
  if (!b) return resp(404);
  const signed = url.host === "signed.s3.test";
  if (method === "OPTIONS") return b.cors ? resp(200, null, { "access-control-allow-methods": "PUT, GET, HEAD", "access-control-allow-origin": "*" }) : resp(403);
  if (method === "PUT") {
    if (!signed) return resp(403);
    const ct = new Headers(init.headers).get("content-type") ?? undefined;
    b.objects.set(key, { body: await toBuffer(init.body), contentType: ct, lastModified: new Date() });
    return resp(200);
  }
  const o = b.objects.get(key);
  if (!signed && !b.publicRead(key)) return resp(403);
  if (!o) return resp(404);
  return resp(200, new Uint8Array(o.body), { "content-type": o.contentType ?? "application/octet-stream" });
}
