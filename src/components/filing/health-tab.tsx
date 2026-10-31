"use client";
// Health tab (Filing guide §13): stat cards, size by type / storage, uploads
// per month, job buttons (each with a dry run), live progress, report list and
// a report viewer with bulk fixes.

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Panel, StatCard } from "@/components/admin/ui";
import { applyReferenceFixes, applyStorageFixes, deleteAbandonedUploads, markDiscoveryFalsePositives, runCheckJob, runImportJob } from "@/server/modules/filing/jobs/jobs.actions";
import type { FileStats } from "@/server/modules/filing/file/file.service";
import type { ReportMeta } from "@/server/modules/filing/lib/reports";
import { formatBytes, ProgressCard, useCurrentJob, type FilingCan } from "./shared";

type Report = Record<string, unknown> & { type: string; id: string; dryRun: boolean; finishedAt: string; summary: Record<string, unknown> };

const JOBS = [
  { type: "IMPORT", label: "Import", help: "Registers objects already in a storage.", needsStorage: true, dry: true },
  { type: "NORMALIZE", label: "Normalize", help: "One canonical URL format in every declared column.", dry: true },
  { type: "REFERENCE_CHECK", label: "Reference check", help: "Verifies every stored URL. Fixes come from its report." },
  { type: "DISCOVERY", label: "Discovery", help: "Finds columns holding storage URLs that are not declared." },
  { type: "STORAGE_CHECK", label: "Storage check", help: "Registry vs storage: orphans, missing, size.", needsStorage: true },
] as const;

const CAP = 1000;

export function HealthTab({ stats, storages, can }: { stats: FileStats; storages: { id: string; name: string }[]; can: FilingCan }) {
  const toast = useToast();
  const [reports, setReports] = useState<ReportMeta[] | null>(null);
  const [open, setOpen] = useState<{ name: string; data: Report } | null>(null);
  const [storageId, setStorageId] = useState(storages[0]?.id ?? "");
  const loadReports = useCallback(async () => {
    const r = await apiGet<ReportMeta[]>("/api/v1/filing/reports", { limit: 100 });
    setReports(r.ok ? (r.data as ReportMeta[]) : []);
  }, []);
  const { job, refresh, busy } = useCurrentJob(() => loadReports());
  useEffect(() => {
    let stop = false;
    apiGet<ReportMeta[]>("/api/v1/filing/reports", { limit: 100 }).then((r) => !stop && setReports(r.ok ? (r.data as ReportMeta[]) : []));
    return () => {
      stop = true;
    };
  }, []);

  const start = async (type: (typeof JOBS)[number]["type"], dryRun: boolean) => {
    const r = type === "IMPORT" ? await runImportJob({ storageId, dryRun }) : await runCheckJob({ type, storageId: storageId || undefined, dryRun });
    if (!r.ok) return toast("error", r.error.message);
    toast("success", `${type.replace(/_/g, " ").toLowerCase()} started${dryRun ? " (dry run)" : ""}.`);
    refresh();
  };

  const openReport = async (name: string) => {
    const r = await apiGet<Report>(`/api/v1/filing/reports/${encodeURIComponent(name)}`);
    if (!r.ok) return toast("error", r.error.message);
    setOpen({ name, data: r.data as Report });
  };

  const maxMonth = Math.max(1, ...stats.perMonth.map((m) => m.count));
  const canRun = (type: string) => (type === "IMPORT" ? can.fileCreate : can.fileUpdate);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active files" value={stats.active.count} />
        <StatCard label="Total size" value={formatBytes(stats.active.size)} />
        <StatCard label="Deleted (history)" value={stats.deleted} />
        <StatCard label="Storages in use" value={stats.byStorage.length} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="By type">
          <ul className="space-y-2 text-sm">
            {stats.byType.map((t) => (
              <li key={t.type} className="flex justify-between">
                <span className="capitalize">{t.type}</span>
                <span className="text-muted">
                  {t.count} · {formatBytes(t.size)}
                </span>
              </li>
            ))}
            {!stats.byType.length && <li className="text-muted">No files yet.</li>}
          </ul>
        </Panel>
        <Panel title="By storage">
          <ul className="space-y-2 text-sm">
            {stats.byStorage.map((t) => (
              <li key={t.storageId} className="flex justify-between gap-2">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-muted">
                  {t.count} · {formatBytes(t.size)}
                </span>
              </li>
            ))}
            {!stats.byStorage.length && <li className="text-muted">No files yet.</li>}
          </ul>
        </Panel>
        <Panel title="Uploads per month">
          <div className="flex h-28 items-end gap-1" role="img" aria-label="Uploads per month, last 12 months">
            {stats.perMonth.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.month}: ${m.count} file(s), ${formatBytes(m.size)}`}>
                <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(2, (m.count / maxMonth) * 96)}px` }} />
                <span className="text-[9px] text-muted">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Jobs" actions={storages.length > 1 ? <Select aria-label="Storage for import and storage check" className="h-9 w-auto" value={storageId} onChange={(e) => setStorageId(e.target.value)}>{storages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select> : undefined}>
        {busy || job?.progress ? <ProgressCard p={job?.progress ?? null} className="mb-4" /> : null}
        <ul className="divide-y divide-line/40">
          {JOBS.map((j) => (
            <li key={j.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{j.label}</p>
                <p className="text-xs text-muted">{j.help}</p>
              </div>
              {canRun(j.type) && (
                <div className="flex gap-2">
                  {"dry" in j && j.dry && (
                    <Button size="sm" variant="outline" disabled={busy || ("needsStorage" in j && !storageId)} onClick={() => start(j.type, true)}>
                      Dry run
                    </Button>
                  )}
                  <Button size="sm" disabled={busy || ("needsStorage" in j && !storageId)} onClick={() => start(j.type, false)}>
                    Run
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Reports" actions={<Button size="sm" variant="ghost" onClick={loadReports}>Refresh</Button>}>
        {reports === null ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : !reports.length ? (
          <p className="text-sm text-muted">No reports yet. Reports are kept as JSON in the storage under _system/reports/.</p>
        ) : (
          <ul className="divide-y divide-line/40 text-sm">
            {reports.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 py-2">
                <button className="min-w-0 text-left" onClick={() => openReport(r.name)}>
                  <span className="block font-medium">{r.type.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="block text-xs text-muted">
                    {r.lastModified ? formatDateTime(r.lastModified) : r.date} · {formatBytes(r.size)}
                  </span>
                </button>
                <Button size="sm" variant="outline" onClick={() => openReport(r.name)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ReportSheet value={open} can={can} onClose={() => setOpen(null)} onStarted={refresh} />
    </div>
  );
}

const LISTS: Record<string, string[]> = {
  REFERENCE_CHECK: ["nonCanonical", "query", "readOnly", "unregistered", "missing"],
  IMPORT: ["abandoned", "referencedButMissing"],
  STORAGE_CHECK: ["orphans", "missing", "sizeMismatch"],
  DISCOVERY: ["findings", "notChecked"],
  NORMALIZE: ["rewrites", "values"],
  MIGRATION: ["missing", "failures", "verification", "swap"],
  PURGE: ["kept"],
  BACKUP: ["skipped"],
  FIXES: ["failures"],
  BASE_URL_CHANGE: ["columns"],
};

function ReportSheet({ value, can, onClose, onStarted }: { value: { name: string; data: Report } | null; can: FilingCan; onClose: () => void; onStarted: () => void }) {
  const toast = useToast();
  const [cats, setCats] = useState<string[]>([]);
  const [marks, setMarks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const name = value?.name ?? null;
  if (seen !== name) {
    setSeen(name);
    setCats([]);
    setMarks([]);
  }
  if (!value) return null;
  const r = value.data;
  const download = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = value.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const act = async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return toast("error", res.error?.message ?? "Failed");
    toast("success", done);
    onStarted();
    onClose();
  };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Sheet open onClose={onClose} title={`${r.type.replace(/_/g, " ").toLowerCase()}${r.dryRun ? " (dry run)" : ""}`} wide>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted">{formatDateTime(r.finishedAt)}</p>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="h-4 w-4" /> Download JSON
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(r.summary ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-mist px-3 py-2">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold">{String(v)}</dd>
            </div>
          ))}
        </dl>

        {r.type === "REFERENCE_CHECK" && can.fileUpdate && (
          <div className="rounded-2xl border border-line/60 p-4">
            <p className="mb-2 font-semibold">Fixes</p>
            {[
              ["nonCanonical", "Rewrite non-canonical URLs"],
              ["query", "Strip query strings / stored presigned URLs"],
              ["readOnly", "Rewrite URLs left on a migrated storage"],
              ["unregistered", "Register (import) unregistered files"],
              ["missing", "Clear missing values (url columns only)"],
            ].map(([k, label]) => (
              <Checkbox key={k} label={`${label} (${(r[k] as unknown[] | undefined)?.length ?? 0})`} checked={cats.includes(k)} onChange={() => toggle(cats, setCats, k)} />
            ))}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || !cats.length} onClick={() => act(() => applyReferenceFixes({ reportName: value.name, categories: cats as never, dryRun: true }), "Fix dry run started.")}>
                Dry run
              </Button>
              <Button size="sm" disabled={busy || !cats.length} onClick={() => act(() => applyReferenceFixes({ reportName: value.name, categories: cats as never, dryRun: false }), "Fixes started.")}>
                Apply fixes
              </Button>
            </div>
          </div>
        )}
        {r.type === "STORAGE_CHECK" && can.fileUpdate && (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-line/60 p-4">
            <Button size="sm" disabled={busy || !(r.missing as unknown[])?.length} onClick={() => act(() => applyStorageFixes({ reportName: value.name, markMissing: true, fixSizes: false, dryRun: false }), "Marking missing files deleted.")}>
              Mark missing as deleted
            </Button>
            <Button size="sm" variant="outline" disabled={busy || !(r.sizeMismatch as unknown[])?.length} onClick={() => act(() => applyStorageFixes({ reportName: value.name, markMissing: false, fixSizes: true, dryRun: false }), "Fixing sizes.")}>
              Fix sizes
            </Button>
          </div>
        )}
        {r.type === "IMPORT" && !r.dryRun && can.fileDelete && (r.abandoned as unknown[])?.length > 0 && (
          <div className="rounded-2xl border border-danger/30 p-4">
            <p className="text-muted">Objects older than 24 h that no declared column uses (uploads never saved). Each is re-checked before deletion.</p>
            <Button size="sm" variant="danger" className="mt-2" disabled={busy} onClick={() => act(() => deleteAbandonedUploads({ reportName: value.name }), "Abandoned uploads deleted.")}>
              Delete abandoned uploads
            </Button>
          </div>
        )}
        {r.type === "DISCOVERY" && can.fileUpdate && (r.findings as unknown[])?.length > 0 && (
          <div className="rounded-2xl border border-line/60 p-4">
            <p className="text-muted">Add real findings to src/config/file-references.ts (the ready line is shown). Mark the others as not a file reference.</p>
            {(r.findings as { table: string; column: string }[]).map((f) => (
              <Checkbox key={`${f.table}.${f.column}`} label={`${f.table}.${f.column}`} checked={marks.includes(`${f.table}.${f.column}`) || (r.falsePositives as string[]).includes(`${f.table}.${f.column}`)} onChange={() => toggle(marks, setMarks, `${f.table}.${f.column}`)} />
            ))}
            <Button size="sm" className="mt-2" disabled={busy || !marks.length} onClick={() => act(() => markDiscoveryFalsePositives({ reportName: value.name, columns: marks }), "Marked as not a file reference.")}>
              Mark as not a file reference
            </Button>
          </div>
        )}

        {(LISTS[r.type] ?? []).map((k) => {
          const list = r[k] as unknown[] | undefined;
          if (!Array.isArray(list) || !list.length) return null;
          return (
            <details key={k} className="rounded-2xl border border-line/60 p-4" open={list.length < 20}>
              <summary className="cursor-pointer font-semibold">
                {k} ({list.length}
                {list.length > CAP ? `, first ${CAP} shown` : ""})
              </summary>
              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto font-mono text-xs break-all">
                {list.slice(0, CAP).map((item, i) => (
                  <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </Sheet>
  );
}
