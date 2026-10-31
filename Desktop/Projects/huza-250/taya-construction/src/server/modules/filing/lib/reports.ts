// JOB REPORTS (guide §1.2): JSON files in storage at
// {prefix}/_system/reports/{yyyy-mm-dd}_{type}_{id}.json. No database table.
// Reports go to the active PRIVATE storage when there is one, else the PUBLIC one.

import { FilingError } from "./errors";
import * as ops from "./storage/ops";
import { storagesOrEmpty, type LoadedStorage } from "./storage/registry";

export type ReportMeta = { name: string; type: string; id: string; date: string; size: number; storageId: string; lastModified: string | null };

async function reportStorage(): Promise<LoadedStorage> {
  const all = [...(await storagesOrEmpty()).values()];
  const s = all.find((x) => x.isActive && x.access === "PRIVATE") ?? all.find((x) => x.isActive);
  if (!s) throw new FilingError("STORAGE_NOT_CONFIGURED", "No active storage to keep reports.");
  return s;
}

const NAME = /^\d{4}-\d{2}-\d{2}_[A-Z_]+_[\w-]+\.json$/;

export async function writeReport(type: string, id: string, data: unknown): Promise<string> {
  const s = await reportStorage();
  const name = `${new Date().toISOString().slice(0, 10)}_${type}_${id}.json`;
  await ops.put(s, `${s.prefix}/_system/reports/${name}`, JSON.stringify(data, null, 2), "application/json", "private, no-store");
  return name;
}

export async function listReports(limit = 100): Promise<ReportMeta[]> {
  const s = await reportStorage().catch(() => null);
  if (!s) return [];
  const out: ReportMeta[] = [];
  for await (const o of ops.list(s, `${s.prefix}/_system/reports/`)) {
    const name = o.key.slice(o.key.lastIndexOf("/") + 1);
    if (!NAME.test(name)) continue;
    const [date, ...rest] = name.replace(/\.json$/, "").split("_");
    const id = rest.pop()!;
    out.push({ name, date, type: rest.join("_"), id, size: o.size, storageId: s.id, lastModified: o.lastModified?.toISOString() ?? null });
  }
  return out.sort((a, b) => b.name.localeCompare(a.name)).slice(0, limit);
}

export async function readReport<T = unknown>(name: string): Promise<T | null> {
  if (!NAME.test(name)) return null;
  const s = await reportStorage();
  const h = await ops.head(s, `${s.prefix}/_system/reports/${name}`);
  if (!h) return null;
  const o = await ops.getStream(s, `${s.prefix}/_system/reports/${name}`);
  const chunks: Buffer[] = [];
  for await (const c of o.body) chunks.push(Buffer.from(c));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

/** The newest report of a type, if any. */
export async function latestReport<T = unknown>(type: string): Promise<{ meta: ReportMeta; data: T } | null> {
  const meta = (await listReports(500)).find((r) => r.type === type);
  if (!meta) return null;
  const data = await readReport<T>(meta.name);
  return data ? { meta, data } : null;
}

/** Rewrites an existing report (DISCOVERY false-positive marks). */
export async function overwriteReport(name: string, data: unknown): Promise<void> {
  if (!NAME.test(name)) throw new FilingError("FILE_KEY_INVALID", "Invalid report name.");
  const s = await reportStorage();
  await ops.put(s, `${s.prefix}/_system/reports/${name}`, JSON.stringify(data, null, 2), "application/json", "private, no-store");
}
