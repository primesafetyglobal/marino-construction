"use client";
// Backups tab (Filing guide §13): list, new backup with estimate, live
// progress, download (5-minute presigned link), delete, files not yet backed up.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { createBackup, deleteBackup } from "@/server/modules/filing/file-backup/file-backup.actions";
import type { BackupDto } from "@/server/modules/filing/file-backup/file-backup.select";
import type { Jsonify } from "@/server/core/result";
import { formatBytes, ProgressCard, useCurrentJob, type FilingCan } from "./shared";

type B = Jsonify<BackupDto>;
type Page = { items: B[]; nextCursor: string | null; notBackedUp: { count: number; size: number } };

const TONE: Record<string, Tone> = { COMPLETED: "success", RUNNING: "info", PENDING: "neutral", FAILED: "danger" };

export function BackupsTab({ initial, can }: { initial: Page; can: FilingCan }) {
  const router = useRouter();
  const toast = useToast();
  const [page, setPage] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPage(initial);
  }
  const reload = useCallback(async () => {
    const r = await apiGet<Page>("/api/v1/filing/backups", { limit: 50 });
    if (r.ok) setPage(r.data as Page);
    router.refresh();
  }, [router]);
  const { job, refresh, busy } = useCurrentJob(() => reload());
  const [newOpen, setNewOpen] = useState(false);
  const [confirm, setConfirm] = useState<B | null>(null);

  const remove = async (b: B) => {
    const r = await deleteBackup({ id: b.id });
    setConfirm(null);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", "Backup deleted.");
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Not yet backed up: <strong className="text-ink">{page.notBackedUp.count}</strong> file(s), {formatBytes(page.notBackedUp.size)}.
        </p>
        {can.backupCreate && (
          <Button disabled={busy} onClick={() => setNewOpen(true)}>
            New backup
          </Button>
        )}
      </div>
      {job?.progress?.type === "BACKUP" && <ProgressCard p={job.progress} />}
      {!page.items.length ? (
        <EmptyState title="No backups yet">A FULL backup zips every file with a manifest.json for a scripted restore.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line/50 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-line/50 bg-mist/60 text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Range</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {page.items.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium">{b.type}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted">
                    {b.fromDate ? formatDateTime(b.fromDate) : "Start"} → {formatDateTime(b.toDate)}
                  </td>
                  <td className="px-4 py-3">{b.fileCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatBytes(b.totalSize)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[b.status] ?? "neutral"}>{b.status.toLowerCase()}</Badge>
                    {b.error && <p className="mt-1 max-w-56 text-xs text-muted">{b.error}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {b.status === "COMPLETED" && (
                        <a aria-label="Download" href={`/api/v1/filing/backups/${b.id}/download`} className="rounded-full p-2 hover:bg-mist">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {can.backupDelete && b.status !== "RUNNING" && b.status !== "PENDING" && (
                        <button aria-label="Delete" onClick={() => setConfirm(b)} className="rounded-full p-2 text-danger hover:bg-danger-tint">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewBackupDialog open={newOpen} onClose={() => setNewOpen(false)} onStarted={() => (refresh(), reload())} />
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete this backup?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirm && remove(confirm)}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">The archive is removed from storage. Files themselves are not touched.</p>
      </Dialog>
    </div>
  );
}

function NewBackupDialog({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<"FULL" | "INCREMENTAL">("INCREMENTAL");
  const [folder, setFolder] = useState("");
  const [est, setEst] = useState<{ type: string; files: number; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let stop = false;
    const t = setTimeout(() => {
      apiGet<{ type: string; files: number; size: number }>("/api/v1/filing/backups/estimate", { type, folder: folder || undefined }).then((r) => !stop && r.ok && setEst(r.data as { type: string; files: number; size: number }));
    }, 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [open, type, folder]);
  const go = async () => {
    setBusy(true);
    const r = await createBackup({ type, folder: folder || null });
    setBusy(false);
    if (!r.ok) return toast("error", r.error.message);
    toast("success", "Backup started.");
    onStarted();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New backup"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={go}>
            Start backup
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <Segmented value={type} onChange={setType} options={[{ value: "INCREMENTAL", label: "Incremental" }, { value: "FULL", label: "Full" }]} />
        <Field label="Folder" optional hint="Only this folder and its sub-folders.">
          <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="All folders" />
        </Field>
        {est && (
          <p className="rounded-xl bg-mist px-3 py-2">
            {est.type === "FULL" && type === "INCREMENTAL" ? "No completed backup yet: this runs as FULL. " : ""}
            About {est.files} file(s), {formatBytes(est.size)}.
          </p>
        )}
      </div>
    </Dialog>
  );
}
