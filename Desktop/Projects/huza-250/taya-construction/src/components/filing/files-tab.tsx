"use client";
// Files tab (Filing guide §13): folder sidebar, toolbar, table or grid, bulk
// move / delete, upload dialog, preview drawer with usage.

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FileText, Folder, FolderPlus, Grid2x2, List, Loader2, Lock, Pencil, Trash2, Upload, X } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useActionForm } from "@/lib/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { Dialog, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { DataTable, FilterBar, useApiList, type Column, type Params } from "@/components/admin/list";
import { deleteFiles, getFileAccessUrl, moveFiles, renameFile, renameFolder } from "@/server/modules/filing/file/file.actions";
import { moveFilesSchema, renameFileSchema, renameFolderSchema, UNFILED } from "@/server/modules/filing/file/file.schema";
import type { FileDto } from "@/server/modules/filing/file/file.select";
import { normalizeFolder, ruleFor, type FolderRules } from "@/server/modules/filing/lib/folder";
import type { Jsonify } from "@/server/core/result";
import { formatBytes, type FilingCan } from "./shared";
import { useUpload } from "./use-upload";

type F = Jsonify<FileDto>;
type FolderRow = { folder: string | null; count: number; size: number };
type Limits = { maxUploadMb: number; allowedMimeTypes: string[]; folderRules: FolderRules | null } | null;

const isImage = (f: Pick<F, "mimeType">) => f.mimeType.startsWith("image/");

export function FilesTab({
  initial,
  params,
  folders: initialFolders,
  storages,
  limits,
  can,
}: {
  initial: { items: F[]; nextCursor: string | null };
  params: Params;
  folders: FolderRow[];
  storages: { id: string; name: string }[];
  limits: Limits;
  can: FilingCan;
}) {
  const router = useRouter();
  const toast = useToast();
  const list = useApiList<F>("/api/v1/filing/files", initial, params);
  const [folders, setFolders] = useState<FolderRow[]>(initialFolders);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<F | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const current = list.params.folder;
  const deletedView = list.params.status === "DELETED";

  const refreshFolders = useCallback(async () => {
    const res = await apiGet<FolderRow[]>("/api/v1/filing/files/folders");
    if (res.ok) setFolders(res.data as FolderRow[]);
  }, []);
  const refreshAll = useCallback(() => {
    list.reload();
    refreshFolders();
    setSelected(new Set());
    router.refresh();
  }, [list, refreshFolders, router]);

  const dropUpload = useUpload({ onUploaded: () => undefined });

  const allFolders = useMemo(() => {
    const names = new Set<string>([...folders.flatMap((f) => (f.folder ? [f.folder] : [])), ...localFolders]);
    // parents of nested folders
    for (const n of [...names]) n.split("/").forEach((_, i, parts) => names.add(parts.slice(0, i + 1).join("/")));
    return [...names].sort();
  }, [folders, localFolders]);
  const stat = (f: string | null) => folders.find((x) => x.folder === f);
  const unfiled = stat(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function onDropFiles(e: DragEvent, folder: string | null) {
    e.preventDefault();
    setDropTarget(null);
    if (!can.fileCreate || !e.dataTransfer.files.length) return;
    const done = await dropUpload.upload(e.dataTransfer.files, { folder });
    const failed = e.dataTransfer.files.length - done.length;
    toast(failed ? "error" : "success", failed ? `${failed} file(s) failed. Open Upload to see why.` : `${done.length} file(s) uploaded to ${folder ?? "Unfiled"}.`);
    refreshAll();
  }

  const folderButton = (label: string, value: string | undefined, opts: { depth?: number; count?: number; status?: string; drop?: string | null } = {}) => {
    const active = opts.status ? list.params.status === opts.status : !deletedView && current === value;
    return (
      <li key={label + (value ?? "")}>
        <button
          onClick={() => {
            list.setParam("status", opts.status);
            list.setParam("folder", value);
            setSelected(new Set());
          }}
          onDragOver={opts.drop !== undefined && can.fileCreate ? (e) => (e.preventDefault(), setDropTarget(value ?? "")) : undefined}
          onDragLeave={() => setDropTarget(null)}
          onDrop={opts.drop !== undefined ? (e) => onDropFiles(e, opts.drop ?? null) : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
            active ? "bg-charcoal font-semibold text-white" : "hover:bg-mist",
            dropTarget === (value ?? "") && "ring-2 ring-brand",
          )}
          style={{ paddingLeft: `${0.5 + (opts.depth ?? 0) * 0.85}rem` }}
        >
          <Folder className="h-4 w-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{label}</span>
          {opts.count !== undefined && <span className={cn("text-xs", active ? "text-white/70" : "text-muted")}>{opts.count}</span>}
        </button>
      </li>
    );
  };

  const columns: Column<F>[] = [
    {
      header: "",
      className: "w-8",
      cell: (f) => <input type="checkbox" aria-label={`Select ${f.name}`} checked={selected.has(f.id)} onChange={() => toggle(f.id)} disabled={deletedView} />,
    },
    {
      header: "Name",
      cell: (f) => (
        <button onClick={() => setPreview(f)} className="flex min-w-0 items-center gap-3 text-left">
          <Thumb f={f} className="h-10 w-10" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{f.name}</span>
            <span className="block text-xs text-muted">{f.folder ?? "Unfiled"}</span>
          </span>
        </button>
      ),
    },
    { header: "Type", className: "hidden md:table-cell", cell: (f) => <span className="text-xs text-muted">{f.mimeType}</span> },
    { header: "Size", className: "whitespace-nowrap", cell: (f) => formatBytes(f.size) },
    { header: "Uploaded", className: "hidden lg:table-cell whitespace-nowrap", cell: (f) => formatDateTime(f.uploadedAt) },
    { header: "Access", className: "hidden sm:table-cell", cell: (f) => (f.access === "PRIVATE" ? <Badge tone="dark" icon={<Lock className="h-3 w-3" />}>Private</Badge> : <Badge>Public</Badge>) },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-[var(--radius-card)] border border-line/50 bg-white p-3 shadow-soft">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Folders</p>
          {can.fileCreate && (
            <button aria-label="New folder" onClick={() => setNewFolderOpen(true)} className="rounded-full p-1 text-muted hover:bg-mist hover:text-ink">
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
        </div>
        <ul className="space-y-0.5">
          {folderButton("All files", undefined, { count: folders.reduce((n, f) => n + f.count, 0) })}
          {folderButton("Unfiled", UNFILED, { count: unfiled?.count ?? 0, drop: null })}
          {allFolders.map((f) => folderButton(f.split("/").pop()!, f, { depth: f.split("/").length - 1, count: stat(f)?.count ?? 0, drop: f }))}
          {folderButton("Deleted (history)", undefined, { status: "DELETED" })}
        </ul>
        {can.fileUpdate && current && current !== UNFILED && !deletedView && (
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setRenaming(current)}>
            <Pencil className="h-3.5 w-3.5" /> Rename folder
          </Button>
        )}
        {dropUpload.busy && <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
        {can.fileCreate && <p className="mt-3 px-1 text-[11px] text-muted">Drop files from your computer onto a folder to upload them there.</p>}
      </aside>

      <section className="min-w-0">
        <FilterBar
          params={list.params}
          setParam={list.setParam}
          filters={[
            { name: "q", label: "Search by name", type: "search" },
            { name: "type", label: "Any type", type: "select", options: [{ value: "image", label: "Images" }, { value: "document", label: "Documents" }, { value: "other", label: "Other" }] },
            ...(storages.length > 1 ? [{ name: "storageId", label: "Any storage", type: "select" as const, options: storages.map((s) => ({ value: s.id, label: s.name })) }] : []),
          ]}
        >
          <Input type="date" aria-label="Uploaded from" className="h-10 w-auto" value={list.params.from ?? ""} onChange={(e) => list.setParam("from", e.target.value)} />
          <Input type="date" aria-label="Uploaded until" className="h-10 w-auto" value={list.params.to ?? ""} onChange={(e) => list.setParam("to", e.target.value)} />
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full border border-line/60 bg-white p-0.5">
              <button aria-label="Table" onClick={() => setView("table")} className={cn("rounded-full p-1.5", view === "table" && "bg-mist")}>
                <List className="h-4 w-4" />
              </button>
              <button aria-label="Grid" onClick={() => setView("grid")} className={cn("rounded-full p-1.5", view === "grid" && "bg-mist")}>
                <Grid2x2 className="h-4 w-4" />
              </button>
            </div>
            {can.fileCreate && (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload
              </Button>
            )}
          </div>
        </FilterBar>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-charcoal px-4 py-2 text-sm text-white">
            <span className="font-semibold">{selected.size} selected</span>
            {can.fileUpdate && (
              <Button size="sm" variant="light" onClick={() => setMoveOpen(true)}>
                Move
              </Button>
            )}
            {can.fileDelete && (
              <Button size="sm" variant="light" onClick={() => setDeleteIds([...selected])}>
                Delete
              </Button>
            )}
            <button className="ml-auto rounded-full p-1 hover:bg-white/10" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {view === "table" ? (
          <DataTable columns={columns} list={list} empty={{ title: deletedView ? "No deleted files" : "No files here yet", action: can.fileCreate && !deletedView ? <Button onClick={() => setUploadOpen(true)}>Upload files</Button> : undefined }} />
        ) : (
          <GridView list={list} selected={selected} toggle={toggle} onOpen={setPreview} disabled={deletedView} />
        )}
        {list.hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={list.loadMore} disabled={list.loading}>
              {list.loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </section>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} folder={current && current !== UNFILED ? current : null} folders={allFolders} limits={limits} onDone={refreshAll} />
      <PreviewSheet file={preview} onClose={() => setPreview(null)} can={can} onDelete={(f) => setDeleteIds([f.id])} onChanged={refreshAll} />
      <MoveDialog open={moveOpen} ids={[...selected]} folders={allFolders} onClose={() => setMoveOpen(false)} onDone={refreshAll} />
      <DeleteDialog ids={deleteIds} single={deleteIds?.length === 1 ? (list.items.find((f) => f.id === deleteIds[0]) ?? preview) : null} onClose={() => setDeleteIds(null)} onDone={() => (setPreview(null), refreshAll())} />
      <RenameFolderDialog from={renaming} onClose={() => setRenaming(null)} onDone={(to) => (list.setParam("folder", to), refreshAll())} />
      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={(name) => {
          setLocalFolders((l) => [...l, name]);
          list.setParam("folder", name);
        }}
      />
    </div>
  );
}

function Thumb({ f, className }: { f: F; className?: string }) {
  if (isImage(f) && f.access === "PUBLIC" && f.status === "ACTIVE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={f.url} alt="" loading="lazy" className={cn("shrink-0 rounded-lg bg-mist object-cover", className)} />;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-mist text-muted", className)}>
      {f.access === "PRIVATE" ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
    </span>
  );
}

function GridView({ list, selected, toggle, onOpen, disabled }: { list: ReturnType<typeof useApiList<F>>; selected: Set<string>; toggle: (id: string) => void; onOpen: (f: F) => void; disabled: boolean }) {
  if (!list.items.length) return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{list.loading ? "Loading…" : "No files here yet."}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {list.items.map((f) => (
        <li key={f.id} className={cn("relative overflow-hidden rounded-2xl border bg-white shadow-soft", selected.has(f.id) ? "border-brand ring-2 ring-brand" : "border-line/50")}>
          <button onClick={() => onOpen(f)} className="block w-full text-left">
            <Thumb f={f} className="aspect-square h-auto w-full rounded-none" />
            <span className="block truncate px-3 pt-2 text-sm font-medium">{f.name}</span>
            <span className="block px-3 pb-2 text-xs text-muted">{formatBytes(f.size)}</span>
          </button>
          {!disabled && <input type="checkbox" aria-label={`Select ${f.name}`} checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="absolute top-2 left-2 h-4 w-4" />}
        </li>
      ))}
    </ul>
  );
}

function UploadDialog({ open, onClose, folder: initialFolder, folders, limits, onDone }: { open: boolean; onClose: () => void; folder: string | null; folders: string[]; limits: Limits; onDone: () => void }) {
  const [folder, setFolder] = useState(initialFolder ?? "");
  const [seenFolder, setSeenFolder] = useState(initialFolder);
  if (seenFolder !== initialFolder) {
    setSeenFolder(initialFolder);
    setFolder(initialFolder ?? "");
  }
  const [hover, setHover] = useState(false);
  const { upload, items, busy, clear } = useUpload();
  const target = normalizeFolder(folder);
  const rule = limits ? ruleFor(target, limits.folderRules) : null;
  const types = rule?.mimeTypes ?? limits?.allowedMimeTypes ?? [];
  const maxMb = Math.min(rule?.maxMb ?? limits?.maxUploadMb ?? 20, limits?.maxUploadMb ?? 20);
  const access = rule?.access ?? "PUBLIC";

  const [rejected, setRejected] = useState<string[]>([]);
  const start = async (files: FileList | File[]) => {
    const ok: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (types.length && !types.includes(f.type)) rejected.push(`${f.name}: type not allowed here`);
      else if (f.size > maxMb * 1024 * 1024) rejected.push(`${f.name}: larger than ${maxMb} MB`);
      else ok.push(f);
    }
    setRejected(rejected);
    if (ok.length) {
      await upload(ok, { folder: target });
      onDone();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (busy) return;
        clear();
        setRejected([]);
        onClose();
      }}
      title="Upload files"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy} onClick={() => (clear(), setRejected([]), onClose())}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Folder" hint={`Goes to the ${access.toLowerCase()} storage · max ${maxMb} MB · ${types.length ? types.map((t) => t.split("/")[1]).join(", ") : "any allowed type"}`}>
          <Input list="filing-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Unfiled" />
          <datalist id="filing-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <label
          onDragOver={(e) => (e.preventDefault(), setHover(true))}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHover(false);
            start(e.dataTransfer.files);
          }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-sm transition-colors", hover ? "border-brand bg-brand/10" : "border-line hover:bg-mist")}
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-muted" />}
          <span className="font-medium">{busy ? "Uploading…" : "Drop files here or choose"}</span>
          <input type="file" multiple className="sr-only" disabled={busy} accept={types.join(",") || undefined} onChange={(e) => e.target.files && start(e.target.files)} />
        </label>
        {rejected.length > 0 && (
          <ul className="space-y-1 text-xs text-danger">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((u, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  <span className={cn("text-xs", u.status === "error" ? "text-danger" : "text-muted")}>{u.status === "error" ? "failed" : `${u.progress}%`}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist">
                  <div className={cn("h-full transition-all", u.status === "error" ? "bg-danger" : "bg-brand")} style={{ width: `${u.status === "error" ? 100 : u.progress}%` }} />
                </div>
                {u.error && <p className="mt-0.5 text-xs text-danger">{u.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function PreviewSheet({ file, onClose, can, onDelete, onChanged }: { file: F | null; onClose: () => void; can: FilingCan; onDelete: (f: F) => void; onChanged: () => void }) {
  const toast = useToast();
  const [usage, setUsage] = useState<{ id: string; rows: { label: string; count: number }[] | null } | null>(null);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const form = useActionForm<FileDto>();
  const [seen, setSeen] = useState<string | null>(null);
  const id = file?.id ?? null;
  if (seen !== id) {
    setSeen(id);
    setEditing(false);
    setName(file?.name ?? "");
  }
  const access = file?.access;
  const status = file?.status;
  useEffect(() => {
    if (!id) return;
    let stop = false;
    apiGet<{ label: string; count: number }[]>(`/api/v1/filing/files/${id}/usage`).then((r) => !stop && setUsage({ id, rows: r.ok ? (r.data as { label: string; count: number }[]) : null }));
    if (access === "PRIVATE" && status === "ACTIVE") getFileAccessUrl({ id }).then((r) => !stop && r.ok && setLink({ id, url: r.data }));
    return () => {
      stop = true;
    };
  }, [id, access, status]);
  if (!file) return null;
  const viewUrl = file.access === "PUBLIC" ? file.url : link?.id === file.id ? link.url : null;

  const copy = async () => {
    let url = file.url;
    if (file.access === "PRIVATE") {
      const r = await getFileAccessUrl({ id: file.id });
      if (!r.ok) return toast("error", r.error.message);
      url = r.data;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast("success", file.access === "PRIVATE" ? "Temporary link copied (expires in minutes)." : "URL copied.");
  };

  return (
    <Sheet open={!!file} onClose={onClose} title={<span className="block truncate">{file.name}</span>} wide>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-line/50 bg-mist">
          {viewUrl && isImage(file) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewUrl} alt={file.name} className="max-h-[50vh] w-full object-contain" />
          ) : viewUrl && file.mimeType === "application/pdf" ? (
            <iframe src={viewUrl} title={file.name} className="h-[50vh] w-full bg-white" />
          ) : (
            <div className="flex h-40 items-center justify-center text-muted">{file.status !== "ACTIVE" ? "Deleted file" : <FileText className="h-8 w-8" />}</div>
          )}
        </div>
        {file.status === "ACTIVE" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy className="h-4 w-4" /> {file.access === "PRIVATE" ? "Copy temporary link" : "Copy URL"}
            </Button>
            <a className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold hover:bg-mist" href={`/api/v1/filing/files/${file.id}?download=1`}>
              <Download className="h-4 w-4" /> Download
            </a>
            {can.fileUpdate && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Rename
              </Button>
            )}
            {can.fileDelete && (
              <Button variant="danger" size="sm" onClick={() => onDelete(file)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        )}
        {editing && (
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await form.run({ schema: renameFileSchema, input: { id: file.id, name }, action: renameFile });
              if (r) {
                setEditing(false);
                toast("success", "Renamed.");
                onChanged();
              }
            }}
          >
            <Field label="Name" error={form.errors.name} className="flex-1">
              <Input placeholder="e.g. site-visit-remera.jpg" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" disabled={form.pending}>
              Save
            </Button>
          </form>
        )}
        <FormError message={form.formError?.message} />
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Folder</dt>
          <dd>{file.folder ?? "Unfiled"}</dd>
          <dt className="text-muted">Type</dt>
          <dd>{file.mimeType}</dd>
          <dt className="text-muted">Size</dt>
          <dd>{formatBytes(file.size)}</dd>
          <dt className="text-muted">Uploaded</dt>
          <dd>{formatDateTime(file.uploadedAt)}</dd>
          <dt className="text-muted">Access</dt>
          <dd>{file.access === "PRIVATE" ? "Private (presigned links only)" : "Public"}</dd>
          <dt className="text-muted">Key</dt>
          <dd className="font-mono text-xs break-all">{file.key}</dd>
          {file.access === "PUBLIC" && (
            <>
              <dt className="text-muted">URL</dt>
              <dd className="font-mono text-xs break-all">{file.url}</dd>
            </>
          )}
        </dl>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Used in</p>
          {usage?.id !== file.id ? (
            <p className="text-sm text-muted">Checking…</p>
          ) : !usage.rows?.length ? (
            <p className="text-sm text-muted">Not used in any declared column.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {usage.rows.map((u) => (
                <li key={u.label}>
                  {u.label}: {u.count} row{u.count === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function MoveDialog({ open, ids, folders, onClose, onDone }: { open: boolean; ids: string[]; folders: string[]; onClose: () => void; onDone: () => void }) {
  const [folder, setFolder] = useState("");
  const form = useActionForm<{ moved: number }>();
  const toast = useToast();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Move ${ids.length} file(s)`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={form.pending}
            onClick={async () => {
              const r = await form.run({ schema: moveFilesSchema, input: { ids, folder: folder || null }, action: moveFiles });
              if (r) {
                toast("success", `${r.moved} file(s) moved.`);
                onClose();
                onDone();
              }
            }}
          >
            Move
          </Button>
        </div>
      }
    >
      <Field label="Destination folder" hint="Leave empty for Unfiled. A file cannot move into a folder whose rule needs another type, size or access." error={form.errors.folder}>
        <Input list="filing-move-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Unfiled" />
        <datalist id="filing-move-folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Field>
      <FormError message={form.formError?.message} />
    </Dialog>
  );
}

function DeleteDialog({ ids, single, onClose, onDone }: { ids: string[] | null; single: F | null; onClose: () => void; onDone: () => void }) {
  const form = useActionForm<{ deleted: number; failed: { id: string; reason: string }[] }>();
  const toast = useToast();
  const [usage, setUsage] = useState<{ id: string; rows: { label: string; count: number }[] } | null>(null);
  const singleId = single?.id ?? null;
  useEffect(() => {
    if (!singleId) return;
    let stop = false;
    apiGet<{ label: string; count: number }[]>(`/api/v1/filing/files/${singleId}/usage`).then((r) => !stop && r.ok && setUsage({ id: singleId, rows: r.data as { label: string; count: number }[] }));
    return () => {
      stop = true;
    };
  }, [singleId]);
  if (!ids) return null;
  const used = usage && usage.id === singleId && ids.length === 1 ? usage.rows.reduce((n, u) => n + u.count, 0) : 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title={ids.length === 1 ? "Delete this file?" : `Delete ${ids.length} files?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={form.pending}
            onClick={async () => {
              const r = await form.run({ input: { ids }, action: deleteFiles });
              if (r) {
                toast(r.failed.length ? "error" : "success", r.failed.length ? `${r.deleted} deleted, ${r.failed.length} failed: ${r.failed[0].reason}` : `${r.deleted} file(s) deleted.`);
                onClose();
                onDone();
              }
            }}
          >
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">The file is removed from storage. The record stays in Deleted (history).</p>
      {used > 0 && (
        <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">
          Still used in {usage!.rows.map((u) => `${u.label} (${u.count})`).join(", ")}. Those pages will show a missing image or link.
        </p>
      )}
      {ids.length > 1 && <p className="mt-3 text-sm text-muted">Usage is not checked for bulk deletes. Open a file to see where it is used.</p>}
      <FormError message={form.formError?.message} />
    </Dialog>
  );
}

function RenameFolderDialog({ from, onClose, onDone }: { from: string | null; onClose: () => void; onDone: (to: string) => void }) {
  const [to, setTo] = useState("");
  const [seen, setSeen] = useState<string | null>(null);
  if (seen !== from) {
    setSeen(from);
    setTo(from ?? "");
  }
  const form = useActionForm<{ renamed: number }>();
  const toast = useToast();
  if (!from) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename folder"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={form.pending}
            onClick={async () => {
              const r = await form.run({ schema: renameFolderSchema, input: { from, to }, action: renameFolder });
              if (r) {
                toast("success", `${r.renamed} file(s) updated.`);
                onClose();
                onDone(normalizeFolder(to) ?? "");
              }
            }}
          >
            Rename
          </Button>
        </div>
      }
    >
      <Field label="New name" hint="Sub-folders move with it. Folder rules in Settings are not renamed." error={form.errors.to ?? form.errors._form}>
        <Input placeholder="e.g. site-photos" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <FormError message={form.formError?.message} />
    </Dialog>
  );
}

function NewFolderDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const n = normalizeFolder(name);
  const valid = !!n && /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,4}$/.test(n);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New folder"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onCreate(n!);
              setName("");
              onClose();
            }}
          >
            Create
          </Button>
        </div>
      }
    >
      <Field label="Name" hint="Folders are virtual: the folder exists once a file is uploaded or moved into it. Use lowercase, digits, “-”; “/” for sub-folders.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. site-photos" />
      </Field>
    </Dialog>
  );
}
