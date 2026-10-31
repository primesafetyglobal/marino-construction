// STORAGE TEST (guide §6.1): objects under {prefix}/_system/healthcheck/,
// always cleaned up. Each failed check carries a fix hint.

import { randomUUID } from "node:crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import * as ops from "./ops";
import type { LoadedStorage } from "./registry";
import { buildUrl } from "./urls";

// warning: shown, but does not fail the test (a public _backups/ only moves archives to the private storage).
export type Check = { name: string; ok: boolean; detail?: string; hint?: string; warning?: boolean };
export type TestReport = { ok: boolean; testedAt: string; storage: { id: string; name: string; access: string }; checks: Check[] };

type TestStorage = Pick<LoadedStorage, "id" | "name" | "client" | "bucket" | "prefix" | "access" | "publicBaseUrl" | "endpoint" | "region" | "forcePathStyle">;

export const corsRule = (origin: string) => [
  { AllowedOrigins: [origin, "http://localhost:3000"], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["Content-Type"], MaxAgeSeconds: 3000 },
];

const appOrigin = () => new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").origin;

export async function testStorage(s: TestStorage, opts: { fetchImpl?: typeof fetch; skipNetwork?: boolean } = {}): Promise<TestReport> {
  const f = opts.fetchImpl ?? fetch;
  const checks: Check[] = [];
  const id = randomUUID();
  const key = `${s.prefix}/_system/healthcheck/${id}.txt`;
  const backupKey = `${s.prefix}/_backups/_healthcheck-${id}.txt`;
  const content = `healthcheck ${id}`;
  const run = async (name: string, fn: () => Promise<string | void>, hint?: string, warning?: boolean) => {
    try {
      const detail = await fn();
      checks.push({ name, ok: true, ...(detail ? { detail } : {}) });
      return true;
    } catch (e) {
      checks.push({ name, ok: false, detail: (e as Error).message, hint, ...(warning ? { warning } : {}) });
      return false;
    }
  };

  const wrote = await run("Put", () => ops.put(s, key, content, "text/plain"), "Check the credentials, the bucket name and the region, and that the key may write under the prefix.");
  if (wrote) {
    await run("Head", async () => {
      const h = await ops.head(s, key);
      if (!h || h.size !== Buffer.byteLength(content)) throw new Error("Object not found or wrong size");
    });
    await run("Get", async () => {
      const o = await s.client.send(new GetObjectCommand({ Bucket: s.bucket, Key: key }));
      const body = await o.Body?.transformToString();
      if (body !== content) throw new Error("Content does not match");
    });
    await run("List on prefix", async () => {
      for await (const o of ops.list(s, `${s.prefix}/_system/healthcheck/`)) if (o.key === key) return;
      throw new Error("Test object not listed");
    }, "Allow s3:ListBucket on the prefix.");
    if (!opts.skipNetwork) {
      await run(
        s.access === "PUBLIC" ? "Anonymous read (must succeed)" : "Anonymous read (must fail)",
        async () => {
          const res = await f(buildUrl(s, key));
          if (s.access === "PUBLIC" && res.status !== 200) throw new Error(`Got ${res.status}`);
          if (s.access === "PRIVATE" && res.status === 200) throw new Error("A private storage is publicly readable");
          return `HTTP ${res.status}`;
        },
        s.access === "PUBLIC" ? "Allow public read (s3:GetObject) on the prefix, or set a public base URL (CDN)." : "Block public access on this bucket or prefix.",
      );
      await ops.put(s, backupKey, "x", "text/plain").catch(() => {});
      await run(
        "Backups not public",
        async () => {
          const res = await f(buildUrl(s, backupKey));
          if (res.status === 200) throw new Error("_backups/ is publicly readable");
          return `HTTP ${res.status}`;
        },
        "Deny public read on {prefix}/_backups/* in the bucket policy. Until then, backups go to a private storage.",
        true,
      );
      await run("Presigned GET", async () => {
        const res = await f(await ops.presignGet(s, key, 60));
        if (res.status !== 200) throw new Error(`Got ${res.status}`);
        const date = res.headers.get("date");
        if (date) {
          const skew = Math.abs(Date.now() - new Date(date).getTime());
          if (skew > 5 * 60 * 1000) throw new Error(`Clock skew ${Math.round(skew / 1000)} s`);
        }
      }, "Check the server clock (NTP) and the credentials.");
      await run(
        "CORS preflight for browser uploads",
        async () => {
          const url = await ops.presignPut(s, `${s.prefix}/_system/healthcheck/${id}-cors.txt`, "text/plain", 1, 60);
          const res = await f(url, { method: "OPTIONS", headers: { Origin: appOrigin(), "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
          const allow = res.headers.get("access-control-allow-methods") ?? "";
          if (!res.ok || !/PUT/i.test(allow)) throw new Error(`Preflight ${res.status}`);
        },
        `Apply this CORS rule to the bucket: ${JSON.stringify(corsRule(appOrigin()))}`,
      );
    }
    await run("Delete", async () => {
      await ops.remove(s, key);
      if (await ops.head(s, key)) throw new Error("Object still present");
    });
  }
  await ops.remove(s, backupKey).catch(() => {});
  return { ok: checks.every((c) => c.ok || c.warning), testedAt: new Date().toISOString(), storage: { id: s.id, name: s.name, access: s.access }, checks };
}

/** True when an anonymous request can read {prefix}/_backups/ (archives must then go elsewhere). */
export async function backupsArePublic(s: TestStorage, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const key = `${s.prefix}/_backups/_probe-${randomUUID()}.txt`;
  await ops.put(s, key, "x", "text/plain");
  try {
    const res = await fetchImpl(buildUrl(s, key));
    return res.status === 200;
  } catch {
    return false;
  } finally {
    await ops.remove(s, key).catch(() => {});
  }
}
