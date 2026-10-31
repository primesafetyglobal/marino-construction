// DISCOVERY (guide §8.4): undeclared columns holding storage URLs. A finding
// marked "not a file reference" is kept in the report and read by the
// migration precheck.

import { FilingError } from "../errors";
import { latestReport, overwriteReport, readReport } from "../reports";
import { discover, type DiscoveryResult } from "../references/discovery";
import { allBases } from "./common";

export type DiscoveryReport = DiscoveryResult & { falsePositives: string[]; summary: { findings: number; unhandled: number; notChecked: number } };

export async function runDiscovery(): Promise<Omit<DiscoveryReport, never>> {
  const r = await discover(await allBases());
  return { ...r, falsePositives: [], summary: { findings: r.findings.length, unhandled: r.findings.length, notChecked: r.notChecked.length } };
}

export async function markFalsePositives(reportName: string, columns: string[]) {
  const r = await readReport<DiscoveryReport & { type: string }>(reportName);
  if (!r || r.type !== "DISCOVERY") throw new FilingError("FILE_NOT_FOUND", "Report not found.");
  const valid = new Set(r.findings.map((f) => `${f.table}.${f.column}`));
  const falsePositives = [...new Set([...r.falsePositives, ...columns.filter((c) => valid.has(c))])];
  const unhandled = r.findings.filter((f) => !falsePositives.includes(`${f.table}.${f.column}`)).length;
  await overwriteReport(reportName, { ...r, falsePositives, summary: { ...r.summary, unhandled } });
  return { falsePositives, unhandled };
}

/** Latest discovery within `maxAgeMs`, with its unhandled findings. */
export async function recentDiscovery(maxAgeMs = 24 * 3600 * 1000) {
  const latest = await latestReport<DiscoveryReport & { finishedAt: string }>("DISCOVERY");
  if (!latest || Date.now() - new Date(latest.data.finishedAt).getTime() > maxAgeMs) return null;
  return latest.data;
}
