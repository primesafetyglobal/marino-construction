"use client";
// Storage tab (Filing guide §13): storage cards, add / edit form with provider
// presets (write-only secret), test report with fix hints, migrate wizard,
// change base URL, purge after retention.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleX, Loader2, Plus } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { useActionForm } from "@/lib/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/field";
import { Dialog, Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { activateStorage, createStorage, deleteStorage, testStorage, updateStorage } from "@/server/modules/filing/file-storage/file-storage.actions";
import { createStorageSchema, updateStorageSchema } from "@/server/modules/filing/file-storage/file-storage.schema";
import type { StorageDto } from "@/server/modules/filing/file-storage/file-storage.select";
import { cancelMigration, changeStorageBaseUrl, finishMigration, markMigrationMissing, purgeStorage, resumeMigration, startMigration } from "@/server/modules/filing/jobs/jobs.actions";
import { changeBaseUrlSchema } from "@/server/modules/filing/jobs/jobs.schema";
import type { PrecheckItem } from "@/server/modules/filing/lib/jobs/migration";
import type { TestReport } from "@/server/modules/filing/lib/storage/test";
import type { Jsonify } from "@/server/core/result";
import { ProgressCard, useCurrentJob, type FilingCan } from "./shared";

type S = Jsonify<StorageDto>;
type T = Jsonify<TestReport>;

const PRESETS: Record<string, { label: string; endpoint: string; region: string; forcePathStyle: boolean }> = {
  aws: { label: "Amazon S3", endpoint: "", region: "eu-north-1", forcePathStyle: false },
  r2: { label: "Cloudflare R2", endpoint: "https://<account-id>.r2.cloudflarestorage.com", region: "auto", forcePathStyle: false },
  minio: { label: "MinIO", endpoint: "http://localhost:9000", region: "us-east-1", forcePathStyle: true },
  b2: { label: "Backblaze B2", endpoint: "https://s3.<region>.backblazeb2.com", region: "eu-central-003", forcePathStyle: false },
  other: { label: "Other S3-compatible", endpoint: "", region: "", forcePathStyle: false },
};

export function StorageTab({ initial, can }: { initial: S[]; can: FilingCan }) {
  const router = useRouter();
  const [storages, setStorages] = useState<S[]>(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setStorages(initial);
  }
  const reload = useCallback(async () => {
    const r = await apiGet<S[]>("/api/v1/filing/storages");
    if (r.ok) setStorages(r.data as S[]);
    router.refresh();
  }, [router]);
  const { job, refresh: refreshJob } = useCurrentJob(() => reload());
  const [form, setForm] = useState<{ storage?: S } | null>(null);
  const [report, setReport] = useState<T | null>(null);
  const [migrate, setMigrate] = useState<S | null>(null);
  const [baseUrl, setBaseUrl] = useState<S | null>(null);
  const [danger, setDanger] = useState<{ kind: "purge" | "delete"; storage: S } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  const migrating = storages.find((s) => s.migrationUnfinished);
  const running = job?.running?.type === "MIGRATION" || job?.running?.type === "PURGE" || job?.running?.type === "BASE_URL_CHANGE";

  const runTest = async (s: S) => {
    setTesting(s.id);
    const r = await testStorage({ id: s.id });
    setTesting(null);
    if (!r.ok) return toast("error", r.error.message);
    setReport(r.data as unknown as T);
    reload();
  };

  const activate = async (s: S) => {
    const r = await activateStorage({ id: s.id });
    if (!r.ok) return toast("error", r.error.message);
    toast("success", `${s.name} is now the active ${s.access.toLowerCase()} storage.`);
    reload();
  };

  return (
    <div className="space-y-5">
      {(running || job?.progress?.type === "MIGRATION") && <ProgressCard p={job?.progress ?? null} />}
      {migrating && (
        <div className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <p className="font-semibold">Migration not finished: {migrating.name} still has {migrating.activeFiles} file(s).</p>
          <p className="mt-1 text-muted">New uploads already go to the new storage. Reads keep working from both. Resume the copy, then finish to swap the stored addresses.</p>
          {can.storageUpdate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={running} onClick={() => setMigrate(migrating)}>
                Open migration
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">One active storage per access receives new uploads. Secrets are encrypted and never shown.</p>
        {can.storageCreate && (
          <Button onClick={() => setForm({})}>
            <Plus className="h-4 w-4" /> Add storage
          </Button>
        )}
      </div>
      {!storages.length ? (
        <EmptyState title="No storage yet">Run the bootstrap script on the server, or add a storage here, then run the test.</EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {storages.map((s) => (
            <li key={s.id} className="rounded-[var(--radius-card)] border border-line/50 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    {s.bucket} / {s.prefix} · {s.region}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={s.access === "PRIVATE" ? "dark" : "neutral"}>{s.access === "PRIVATE" ? "Private" : "Public"}</Badge>
                  {s.isActive && <Badge tone="success">Active</Badge>}
                  {s.isReadOnly && <Badge tone="warning">Read-only</Badge>}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted">Base URL</dt>
                <dd className="font-mono text-xs break-all">{s.canonicalBase}</dd>
                <dt className="text-muted">Endpoint</dt>
                <dd className="text-xs break-all">{s.endpoint ?? "AWS default"}</dd>
                <dt className="text-muted">Access key</dt>
                <dd className="font-mono text-xs">{s.accessKeyId}</dd>
                <dt className="text-muted">Files</dt>
                <dd>
                  {s.activeFiles} active{s.backups ? ` · ${s.backups} backup(s)` : ""}
                </dd>
                <dt className="text-muted">Last test</dt>
                <dd>
                  {s.lastTest ? (
                    <button className={cn("font-medium underline", s.lastTest.ok ? "text-success" : "text-danger")} onClick={() => setReport(s.lastTest)}>
                      {s.lastTest.ok ? "Passed" : "Failed"} · {formatDateTime(s.lastTest.testedAt)}
                    </button>
                  ) : (
                    <span className="text-muted">Not tested since the last restart</span>
                  )}
                </dd>
                {s.retentionEndsAt && (
                  <>
                    <dt className="text-muted">Retention</dt>
                    <dd>Kept untouched until {formatDate(s.retentionEndsAt)}</dd>
                  </>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {can.storageUpdate && (
                  <Button size="sm" variant="outline" disabled={testing === s.id} onClick={() => runTest(s)}>
                    {testing === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Test
                  </Button>
                )}
                {can.storageUpdate && (
                  <Button size="sm" variant="outline" onClick={() => setForm({ storage: s })}>
                    Edit
                  </Button>
                )}
                {can.storageUpdate && !s.isActive && !s.isReadOnly && (
                  <Button size="sm" variant="outline" onClick={() => activate(s)}>
                    Activate
                  </Button>
                )}
                {can.storageUpdate && s.isActive && s.activeFiles > 0 && !migrating && (
                  <Button size="sm" variant="outline" disabled={running} onClick={() => setMigrate(s)}>
                    Migrate
                  </Button>
                )}
                {can.storageUpdate && s.isActive && (
                  <Button size="sm" variant="outline" disabled={running} onClick={() => setBaseUrl(s)}>
                    Change base URL
                  </Button>
                )}
                {can.storageDelete && s.isReadOnly && !s.migrationUnfinished && (
                  <Button size="sm" variant="danger" disabled={running} onClick={() => setDanger({ kind: "purge", storage: s })}>
                    Purge
                  </Button>
                )}
                {can.storageDelete && !s.isActive && s.activeFiles === 0 && (
                  <Button size="sm" variant="danger" onClick={() => setDanger({ kind: "delete", storage: s })}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <StorageForm
        open={!!form}
        storage={form?.storage}
        onClose={() => setForm(null)}
        onSaved={(t) => {
          setForm(null);
          setReport(t);
          reload();
        }}
      />
      <TestReportDialog report={report} onClose={() => setReport(null)} />
      <MigrateSheet storage={migrate} storages={storages} onClose={() => setMigrate(null)} onStarted={() => (refreshJob(), reload())} />
      <BaseUrlDialog storage={baseUrl} onClose={() => setBaseUrl(null)} onStarted={() => (refreshJob(), reload())} />
      <DangerDialog value={danger} onClose={() => setDanger(null)} onDone={() => (refreshJob(), reload())} />
    </div>
  );
}

function StorageForm({ open, storage, onClose, onSaved }: { open: boolean; storage?: S; onClose: () => void; onSaved: (t: T) => void }) {
  const editing = !!storage;
  const empty = { name: "", endpoint: "", region: "eu-north-1", bucket: "", prefix: "marino", forcePathStyle: false, accessKeyId: "", secretAccessKey: "", publicBaseUrl: "", access: "PUBLIC" };
  const fromStorage = (s?: S) =>
    s
      ? { name: s.name, endpoint: s.endpoint ?? "", region: s.region, bucket: s.bucket, prefix: s.prefix, forcePathStyle: s.forcePathStyle, accessKeyId: "", secretAccessKey: "", publicBaseUrl: s.publicBaseUrl ?? "", access: s.access }
      : empty;
  const [v, setV] = useState(fromStorage(storage));
  const [seen, setSeen] = useState<S | undefined>(storage);
  const [wasOpen, setWasOpen] = useState(open);
  if (seen !== storage || wasOpen !== open) {
    setSeen(storage);
    setWasOpen(open);
    setV(fromStorage(storage));
  }
  const form = useActionForm<{ test: unknown }>();
  const locked = editing && storage!.activeFiles > 0;
  const set = (k: keyof typeof v, val: string | boolean) => setV((p) => ({ ...p, [k]: val }));

  const submit = async () => {
    const r = editing
      ? await form.run({
          schema: updateStorageSchema,
          action: updateStorage,
          input: {
            id: storage!.id,
            name: v.name,
            ...(locked ? {} : { endpoint: v.endpoint || null, region: v.region, bucket: v.bucket, prefix: v.prefix, forcePathStyle: v.forcePathStyle, access: v.access }),
            ...(v.accessKeyId ? { accessKeyId: v.accessKeyId } : {}),
            secretAccessKey: v.secretAccessKey,
          },
        })
      : await form.run({ schema: createStorageSchema, action: createStorage, input: { ...v, endpoint: v.endpoint || null, publicBaseUrl: v.publicBaseUrl || null } });
    if (r) onSaved(r.test as T);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${storage!.name}` : "Add storage"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={form.pending} onClick={submit}>
            {form.pending && <Loader2 className="h-4 w-4 animate-spin" />} Save and test
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!editing && (
          <Field label="Provider">
            <Select
              defaultValue="aws"
              onChange={(e) => {
                const p = PRESETS[e.target.value];
                setV((x) => ({ ...x, endpoint: p.endpoint, region: p.region, forcePathStyle: p.forcePathStyle }));
              }}
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Name" error={form.errors.name}>
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="AWS S3 (eu-north-1)" />
        </Field>
        {locked && <p className="rounded-xl bg-mist px-3 py-2 text-xs text-muted">Bucket, prefix, endpoint, region, path style and access are locked while the storage has files. Create a new storage and migrate instead.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bucket" error={form.errors.bucket}>
            <Input placeholder="e.g. kigalijob" value={v.bucket} disabled={locked} onChange={(e) => set("bucket", e.target.value)} />
          </Field>
          <Field label="Prefix" hint="App folder in the bucket" error={form.errors.prefix}>
            <Input placeholder="e.g. marino-cons" value={v.prefix} disabled={locked} onChange={(e) => set("prefix", e.target.value)} />
          </Field>
          <Field label="Region" error={form.errors.region}>
            <Input placeholder="e.g. eu-north-1" value={v.region} disabled={locked} onChange={(e) => set("region", e.target.value)} />
          </Field>
          <Field label="Access" error={form.errors.access}>
            <Select value={v.access} disabled={locked} onChange={(e) => set("access", e.target.value)}>
              <option value="PUBLIC">Public (readable by URL)</option>
              <option value="PRIVATE">Private (presigned links only)</option>
            </Select>
          </Field>
        </div>
        <Field label="Endpoint" optional hint="Empty for AWS. Needed for R2, MinIO, B2." error={form.errors.endpoint}>
          <Input value={v.endpoint} disabled={locked} onChange={(e) => set("endpoint", e.target.value)} placeholder="https://…" />
        </Field>
        <Checkbox label="Path-style URLs (MinIO and some others)" checked={v.forcePathStyle} disabled={locked} onChange={(e) => set("forcePathStyle", e.target.checked)} />
        {!editing && (
          <Field label="Public base URL" optional hint="CDN or custom domain. Later changes go through “Change base URL”." error={form.errors.publicBaseUrl}>
            <Input value={v.publicBaseUrl} onChange={(e) => set("publicBaseUrl", e.target.value)} placeholder="https://cdn.example.com" />
          </Field>
        )}
        <Field label="Access key id" hint={editing ? `Current: ${storage!.accessKeyId}. Leave empty to keep.` : undefined} error={form.errors.accessKeyId}>
          <Input placeholder="16 digits" value={v.accessKeyId} autoComplete="off" onChange={(e) => set("accessKeyId", e.target.value)} />
        </Field>
        <Field label="Secret access key" hint={editing ? "Write-only. Leave empty to keep the stored secret." : "Stored encrypted. Never shown again."} error={form.errors.secretAccessKey}>
          <Input placeholder="Paste the key" type="password" value={v.secretAccessKey} autoComplete="new-password" onChange={(e) => set("secretAccessKey", e.target.value)} />
        </Field>
        <FormError message={form.formError?.message} />
      </div>
    </Sheet>
  );
}

function TestReportDialog({ report, onClose }: { report: T | null; onClose: () => void }) {
  if (!report) return null;
  return (
    <Dialog open onClose={onClose} title={`Storage test: ${report.ok ? "passed" : "failed"}`}>
      <ul className="space-y-3 text-sm">
        {report.checks.map((c) => (
          <li key={c.name} className="flex gap-2">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : c.warning ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <div className="min-w-0">
              <p className="font-medium">
                {c.name}
                {c.detail && <span className="font-normal text-muted"> · {c.detail}</span>}
              </p>
              {!c.ok && c.hint && <p className="mt-0.5 text-xs break-words text-muted">{c.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Tested {formatDateTime(report.testedAt)}</p>
    </Dialog>
  );
}

function MigrateSheet({ storage, storages, onClose, onStarted }: { storage: S | null; storages: S[]; onClose: () => void; onStarted: () => void }) {
  const toast = useToast();
  const unfinished = storage?.migrationUnfinished ?? false;
  const candidates = storages.filter((s) => storage && s.id !== storage.id && s.access === storage.access && !s.isActive);
  const [targetId, setTargetId] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; items: PrecheckItem[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [skipBackup, setSkipBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ lastReport: { name: string; summary: Record<string, number | null>; missing: string[]; verification: { table: string; column: string; rows: number }[]; finished: boolean } | null } | null>(null);
  const storageId = storage?.id;

  useEffect(() => {
    if (!storageId) return;
    let stop = false;
    apiGet<typeof state>("/api/v1/filing/jobs/migration").then((r) => !stop && r.ok && setState(r.data as typeof state));
    return () => {
      stop = true;
    };
  }, [storageId]);

  if (!storage) return null;
  const runPrecheck = async () => {
    if (!targetId) return;
    setChecking(true);
    const r = await apiGet<{ ok: boolean; items: PrecheckItem[] }>("/api/v1/filing/jobs/migration/precheck", { sourceId: storage.id, targetId });
    setChecking(false);
    if (!r.ok) return toast("error", r.error.message);
    setCheck(r.data as { ok: boolean; items: PrecheckItem[] });
  };
  const act = async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast("error", r.error?.message ?? "Failed");
    toast("success", done);
    onStarted();
    onClose();
  };
  const blocking = check?.items.filter((i) => !i.ok && !(i.skippable && skipBackup)) ?? [];
  const last = state?.lastReport;

  return (
    <Sheet open onClose={onClose} title={unfinished ? `Migration from ${storage.name}` : `Migrate ${storage.name}`} wide>
      {unfinished ? (
        <div className="space-y-4 text-sm">
          <p>
            {storage.activeFiles} file(s) are still on <strong>{storage.name}</strong>. Resume copies them; nothing already copied is copied again.
          </p>
          {last && (
            <div className="rounded-2xl bg-mist p-4">
              <p className="font-semibold">Last run · {last.name}</p>
              <p className="mt-1 text-muted">
                copied {last.summary.copied} · missing {last.summary.missing} · failures {last.summary.failures} · verification {last.summary.verification ?? "not run"}
              </p>
              {last.missing.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted">Missing objects block the finish. After checking they are really gone, mark them deleted:</p>
                  <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-xs">
                    {last.missing.slice(0, 200).map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                  <Button size="sm" variant="danger" className="mt-2" disabled={busy} onClick={() => act(() => markMigrationMissing({ sourceId: storage.id, keys: last.missing }), "Missing files marked deleted.")}>
                    Mark {last.missing.length} missing as deleted
                  </Button>
                </div>
              )}
              {last.verification.length > 0 && (
                <ul className="mt-3 text-xs text-danger">
                  {last.verification.map((v) => (
                    <li key={`${v.table}.${v.column}`}>
                      {v.table}.{v.column}: {v.rows} row(s) still use the old address. Finish again, or fix through the reference check.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act(() => resumeMigration({ sourceId: storage.id }), "Copy resumed.")}>
              Resume copy
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => act(() => cancelMigration({}), "Cancel requested. Copied files stay on the new storage.")}>
              Cancel copy
            </Button>
            <Button variant="outline" disabled={busy || storage.activeFiles > 0} onClick={() => act(() => finishMigration({ sourceId: storage.id }), "Swapping stored addresses.")}>
              Finish migration
            </Button>
          </div>
          <p className="text-xs text-muted">After the swap, cached public pages refresh within 5 minutes. The old storage stays read-only for 30 days so old links keep working; then purge it.</p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <Field label="Target storage" hint="Same access and prefix; created and tested beforehand.">
            <Select value={targetId} onChange={(e) => (setTargetId(e.target.value), setCheck(null))}>
              <option value="">Choose…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.bucket}/{s.prefix})
                </option>
              ))}
            </Select>
          </Field>
          {!candidates.length && <p className="text-muted">Add another {storage.access.toLowerCase()} storage first.</p>}
          <Button variant="outline" disabled={!targetId || checking} onClick={runPrecheck}>
            {checking && <Loader2 className="h-4 w-4 animate-spin" />} Run precheck
          </Button>
          {check && (
            <ul className="space-y-2">
              {check.items.map((i) => (
                <li key={i.id} className="flex gap-2">
                  {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : i.skippable ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                  <span>
                    {i.label}
                    {i.detail && <span className="text-muted"> · {i.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {check?.items.some((i) => i.skippable && !i.ok) && <Checkbox label="Start without a fresh FULL backup (I accept the risk)" checked={skipBackup} onChange={(e) => setSkipBackup(e.target.checked)} />}
          <p className="text-xs text-muted">Run Discovery and Normalize from the Health tab, and take a FULL backup from Backups, before starting.</p>
          <Button disabled={!check || blocking.length > 0 || busy} onClick={() => act(() => startMigration({ sourceId: storage.id, targetId, skipBackup }), "Migration started. New uploads now go to the target.")}>
            Start migration
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function BaseUrlDialog({ storage, onClose, onStarted }: { storage: S | null; onClose: () => void; onStarted: () => void }) {
  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const form = useActionForm<{ jobId: string }>();
  const toast = useToast();
  if (!storage) return null;
  const go = async (dryRun: boolean) => {
    const r = await form.run({ schema: changeBaseUrlSchema, action: changeStorageBaseUrl, input: { storageId: storage.id, publicBaseUrl: url || null, imageHostConfirmed: confirmed || undefined, dryRun } });
    if (r) {
      toast("success", dryRun ? "Dry run started: see Health for the report." : "Base URL change started.");
      onStarted();
      if (!dryRun) onClose();
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Change base URL"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={form.pending} onClick={() => go(true)}>
            Dry run
          </Button>
          <Button disabled={form.pending} onClick={() => go(false)}>
            Change and rewrite
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">Same storage, new address (CDN or custom domain). The test runs against the new address first, then every stored URL is rewritten. Current: {storage.canonicalBase}</p>
        <Field label="New public base URL" hint="Empty = the default address built from the bucket." error={form.errors.publicBaseUrl}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://files.marino-construction.rw" />
        </Field>
        <Checkbox label="The new host is in FILING_IMAGE_HOSTS (next.config) and that build is deployed" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {form.errors.imageHostConfirmed && <p className="text-xs text-danger">{form.errors.imageHostConfirmed[0]}</p>}
        <FormError message={form.formError?.message} />
      </div>
    </Dialog>
  );
}

function DangerDialog({ value, onClose, onDone }: { value: { kind: "purge" | "delete"; storage: S } | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [deleteBackups, setDeleteBackups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  if (!value) return null;
  const { kind, storage } = value;
  const go = async () => {
    setBusy(true);
    setError(null);
    const r = kind === "purge" ? await purgeStorage({ sourceId: storage.id, confirmName: name, deleteBackups }) : await deleteStorage({ id: storage.id, confirmName: name });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    toast("success", kind === "purge" ? "Purge started." : "Storage deleted.");
    setName("");
    onClose();
    onDone();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === "purge" ? `Purge ${storage.name}` : `Delete ${storage.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || name !== storage.name} onClick={go}>
            {kind === "purge" ? "Purge" : "Delete"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {kind === "purge" ? (
          <p className="text-muted">Deletes each object of this storage only where the new storage holds a verified copy. Objects without a copy are listed and kept. Backup archives are copied to the new storage first. This cannot be undone.</p>
        ) : (
          <p className="text-muted">Removes the storage record. Only possible with no files and no backups pointing to it.</p>
        )}
        {kind === "purge" && <Checkbox label="Delete the backup archives on this storage instead of copying them" checked={deleteBackups} onChange={(e) => setDeleteBackups(e.target.checked)} />}
        <Field label={`Type “${storage.name}” to confirm`}>
          <Input placeholder="Type the storage name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
