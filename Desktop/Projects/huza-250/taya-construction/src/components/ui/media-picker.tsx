"use client";
// MediaPicker (Design §7): the one upload control for every field.
//
// Mode "image" (single or gallery) or "file" (PDF / document). Two tabs:
// - Upload new: drag and drop or browse, type and size checked first, one
//   progress bar per file. Every upload goes through the owning module's
//   signed ticket, which calls the Filing module (requestUpload → browser PUT
//   → confirmUpload on save), so each saved upload is a Filing File record.
// - Library (staff forms only, pass `library`): ACTIVE Filing files from
//   GET /api/v1/filing/files, filtered by folder and type, searchable, paged.
//   Public forms never pass `library`.
//
// The value stays what the forms already send: "upload:<token>" for a new
// upload, or the file's https URL (library picks and existing values).
// Removing an item from the value never deletes the File.

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileText, ImageIcon, Loader2, Search, Star, Upload, X } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/server/core/result";
import { Dialog } from "./sheet";

type Ticket = { uploadUrl: string; headers: Record<string, string>; uploadToken: string };
export type GetTicket = (input: { mimeType: string; sizeBytes: number }) => Promise<ActionResult<Ticket>>;

type LibraryFile = { id: string; name: string; mimeType: string; size: number; url: string; access: "PUBLIC" | "PRIVATE"; folder: string | null };
type Meta = { name?: string; size?: number; preview?: string; openHref?: string };
type Queued = { id: string; name: string; size: number; progress: number; status: "uploading" | "done" | "error"; error?: string };

export function formatBytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const nameFromUrl = (v: string) => {
  try {
    return decodeURIComponent(new URL(v).pathname.split("/").pop() ?? "File").replace(/^[0-9a-f-]{36}-/, "");
  } catch {
    return "File";
  }
};

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload failed. Please try again.")));
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

// Browser → storage directly with a signed ticket. Returns the "upload:<token>" reference.
export async function uploadWithTicket(file: File, getTicket: GetTicket, onProgress?: (pct: number) => void): Promise<{ ok: true; ref: string } | { ok: false; message: string }> {
  const ticket = await getTicket({ mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
  if (!ticket.ok) return { ok: false, message: ticket.error.message };
  try {
    await putWithProgress(ticket.data.uploadUrl, ticket.data.headers, file, onProgress ?? (() => {}));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  return { ok: true, ref: `upload:${ticket.data.uploadToken}` };
}

const matches = (accept: string, type: string) =>
  accept.split(",").some((a) => {
    const t = a.trim();
    return t === type || (t.endsWith("/*") && type.startsWith(t.slice(0, -1)));
  });

const label = (accept: string) =>
  accept
    .split(",")
    .map((t) => t.split("/")[1]?.replace("svg+xml", "SVG").replace("jpeg", "JPG").toUpperCase())
    .filter(Boolean)
    .join(", ");

export type MediaPickerProps = {
  mode?: "image" | "file";
  enabled: boolean;
  value: string[];
  onChange: (refs: string[]) => void;
  getTicket: GetTicket;
  accept?: string;
  multiple?: boolean;
  max?: number;
  maxMb?: number;
  label?: string;
  error?: string;
  /** Staff forms only: show the Filing library of this folder. */
  library?: { folder: string };
};

export function MediaPicker({
  mode: modeIn,
  enabled,
  value,
  onChange,
  getTicket,
  accept = "image/jpeg,image/png,image/webp",
  multiple = true,
  max = 10,
  maxMb,
  label: buttonLabel,
  error,
  library,
}: MediaPickerProps) {
  const mode = modeIn ?? (accept.includes("image") && !accept.includes("pdf") ? "image" : "file");
  const limitMb = maxMb ?? (mode === "image" ? 8 : 10);
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const room = multiple ? Math.max(0, max - value.length) : 1;

  const add = (refs: string[], m: Record<string, Meta>) => {
    setMeta((x) => ({ ...x, ...m }));
    onChange(multiple ? [...value, ...refs].slice(0, max) : refs.slice(-1));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  if (!enabled && !library) {
    return <p className="rounded-[var(--radius-input)] border border-dashed border-line-strong bg-canvas px-4 py-3 text-sm text-muted">Uploads are not configured yet. You can still send the form.</p>;
  }

  const addLabel = buttonLabel ?? (mode === "image" ? (multiple ? "Add photos" : "Add image") : "Add file");

  return (
    <div className="space-y-3">
      {value.length > 0 &&
        (mode === "image" ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Selected images">
            {value.map((ref, i) => {
              const src = meta[ref]?.preview ?? (ref.startsWith("https://") ? ref : "");
              return (
                <li
                  key={ref}
                  draggable={multiple}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                  }}
                  className={cn("group relative aspect-[4/3] overflow-hidden rounded-[12px] border border-line bg-canvas", multiple && "cursor-grab", dragFrom === i && "opacity-50")}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={meta[ref]?.name ?? `Image ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted">
                      <ImageIcon className="h-6 w-6" />
                    </span>
                  )}
                  {i === 0 && multiple && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-charcoal px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                  <div className="absolute inset-x-1 top-1 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    {multiple && i > 0 && (
                      <>
                        <IconBtn label={`Set image ${i + 1} as cover`} onClick={() => move(i, 0)}>
                          <Star className="h-3 w-3" />
                        </IconBtn>
                        <IconBtn label={`Move image ${i + 1} earlier`} onClick={() => move(i, i - 1)}>
                          <ArrowLeft className="h-3 w-3" />
                        </IconBtn>
                      </>
                    )}
                    {multiple && i < value.length - 1 && (
                      <IconBtn label={`Move image ${i + 1} later`} onClick={() => move(i, i + 1)}>
                        <ArrowRight className="h-3 w-3" />
                      </IconBtn>
                    )}
                    <IconBtn label={`Remove image ${i + 1}`} onClick={() => remove(i)}>
                      <X className="h-3 w-3" />
                    </IconBtn>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-2" aria-label="Selected files">
            {value.map((ref, i) => {
              const m = meta[ref] ?? {};
              const href = m.openHref ?? m.preview ?? undefined;
              return (
                <li key={ref} className="flex items-center gap-3 rounded-[12px] border border-line bg-white px-3 py-2.5 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-muted">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name ?? (ref.startsWith("https://") ? nameFromUrl(ref) : "Uploaded file")}</span>
                    <span className="num block text-xs text-muted">{m.size ? formatBytes(m.size) : ref.startsWith("upload:") ? "Uploaded, saved with the form" : "Current file"}</span>
                  </span>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold hover:bg-canvas">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <IconBtn label="Remove file" onClick={() => remove(i)} plain>
                    <X className="h-4 w-4" />
                  </IconBtn>
                </li>
              );
            })}
          </ul>
        ))}
      {room > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-input)] border border-dashed border-line-strong bg-white px-4 py-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-canvas"
        >
          <Upload className="h-4 w-4" />
          {value.length && !multiple ? (mode === "image" ? "Replace image" : "Replace file") : addLabel}
          <span className="text-xs font-normal text-muted">
            {label(accept)} · up to {limitMb} MB
          </span>
        </button>
      )}
      {multiple && value.length > 1 && mode === "image" && <p className="text-xs text-muted">Drag to reorder, or use the arrows. The first photo is the cover.</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "image" ? "Add images" : "Add a file"} size="xl">
        <PickerBody
          mode={mode}
          enabled={enabled}
          accept={accept}
          limitMb={limitMb}
          room={room}
          multiple={multiple}
          getTicket={getTicket}
          library={library}
          onAdd={(refs, m) => {
            add(refs, m);
            setOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function IconBtn({ label, onClick, children, plain }: { label: string; onClick: () => void; children: React.ReactNode; plain?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn("inline-flex items-center justify-center rounded-md transition-colors", plain ? "h-8 w-8 text-muted hover:bg-canvas hover:text-ink" : "h-6 w-6 bg-white/95 text-ink shadow-soft hover:bg-brand")}>
      {children}
    </button>
  );
}

function PickerBody({
  mode,
  enabled,
  accept,
  limitMb,
  room,
  multiple,
  getTicket,
  library,
  onAdd,
}: {
  mode: "image" | "file";
  enabled: boolean;
  accept: string;
  limitMb: number;
  room: number;
  multiple: boolean;
  getTicket: GetTicket;
  library?: { folder: string };
  onAdd: (refs: string[], meta: Record<string, Meta>) => void;
}) {
  const [tab, setTab] = useState<"upload" | "library">(enabled || !library ? "upload" : "library");
  const tabsId = useId();
  return (
    <div>
      {library && (
        <div role="tablist" aria-label="Source" className="mb-5 inline-flex rounded-[12px] border border-line bg-canvas p-1">
          {(["upload", "library"] as const).map((t) => (
            <button
              key={t}
              id={`${tabsId}-${t}`}
              role="tab"
              type="button"
              aria-selected={tab === t}
              aria-controls={`${tabsId}-${t}-panel`}
              onClick={() => setTab(t)}
              onKeyDown={(e) => (e.key === "ArrowRight" || e.key === "ArrowLeft") && setTab(tab === "upload" ? "library" : "upload")}
              className={cn("rounded-[9px] px-4 py-1.5 text-sm font-medium", tab === t ? "bg-white text-ink shadow-soft ring-1 ring-line" : "text-muted hover:text-ink")}
            >
              {t === "upload" ? "Upload new" : "Library"}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={library ? `${tabsId}-${tab}` : undefined}>
        {tab === "upload" ? (
          enabled ? (
            <UploadTab accept={accept} limitMb={limitMb} room={room} multiple={multiple} getTicket={getTicket} onAdd={onAdd} />
          ) : (
            <p className="rounded-[12px] border border-dashed border-line-strong bg-canvas px-4 py-6 text-center text-sm text-muted">Uploads are not configured yet: no active storage. Pick an existing file from the Library, or ask an admin to activate a storage in Files → Storage.</p>
          )
        ) : (
          <LibraryTab mode={mode} folder={library!.folder} room={room} multiple={multiple} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}

function UploadTab({ accept, limitMb, room, multiple, getTicket, onAdd }: { accept: string; limitMb: number; room: number; multiple: boolean; getTicket: GetTicket; onAdd: (refs: string[], meta: Record<string, Meta>) => void }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const start = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, room);
    const checked = list.map((f) => {
      const id = `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`;
      const err = !matches(accept, f.type) ? `${label(accept)} only.` : f.size > limitMb * 1024 * 1024 ? `Larger than ${limitMb} MB.` : null;
      return { f, q: { id, name: f.name, size: f.size, progress: 0, status: err ? "error" : "uploading", error: err ?? undefined } as Queued };
    });
    setQueue((q) => [...q, ...checked.map((c) => c.q)]);
    setBusy(true);
    const refs: string[] = [];
    const meta: Record<string, Meta> = {};
    for (const { f, q } of checked) {
      if (q.status === "error") continue;
      const set = (patch: Partial<Queued>) => setQueue((all) => all.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
      const r = await uploadWithTicket(f, getTicket, (pct) => set({ progress: pct }));
      if (!r.ok) {
        set({ status: "error", error: r.message });
        continue;
      }
      set({ status: "done", progress: 100 });
      refs.push(r.ref);
      const preview = URL.createObjectURL(f);
      meta[r.ref] = { name: f.name, size: f.size, preview, openHref: preview };
    }
    setBusy(false);
    if (refs.length) onAdd(refs, meta);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setHover(false);
    if (!busy && e.dataTransfer.files.length) start(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => (e.preventDefault(), setHover(true))}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        className={cn("blueprint flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition-colors", hover ? "border-brand bg-brand-tint/50" : "border-line-strong")}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-line bg-white shadow-soft">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span>
        <p className="text-sm font-medium">Drag {multiple ? "files" : "a file"} here, or</p>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-10 items-center rounded-[var(--radius-input)] border border-brand-hover/40 bg-brand px-4 text-sm font-semibold text-charcoal hover:bg-brand-hover disabled:opacity-60">
          Browse your device
        </button>
        <p className="text-xs text-muted">
          {label(accept)} · up to {limitMb} MB{multiple ? ` · ${room} more allowed` : ""}
        </p>
        <input ref={input} type="file" className="sr-only" tabIndex={-1} accept={accept} multiple={multiple} onChange={(e) => e.target.files && start(e.target.files)} />
      </div>
      {queue.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {queue.map((q) => (
            <li key={q.id} className="rounded-[12px] border border-line px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{q.name}</span>
                <span className={cn("num shrink-0 text-xs", q.status === "error" ? "text-danger" : "text-muted")}>{q.status === "error" ? "Failed" : q.status === "done" ? "Done" : `${q.progress}%`}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-label={`Upload of ${q.name}`} aria-valuenow={q.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full transition-[width] duration-200", q.status === "error" ? "bg-danger" : q.status === "done" ? "bg-success" : "bg-brand")} style={{ width: `${q.status === "error" ? 100 : q.progress}%` }} />
              </div>
              {q.error && <p className="mt-1 text-xs text-danger">{q.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LibraryTab({ mode, folder, room, multiple, onAdd }: { mode: "image" | "file"; folder: string; room: number; multiple: boolean; onAdd: (refs: string[], meta: Record<string, Meta>) => void }) {
  const [q, setQ] = useState("");
  const [onlyFolder, setOnlyFolder] = useState(true);
  const [items, setItems] = useState<LibraryFile[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<LibraryFile[]>([]);

  const load = useCallback(
    async (after?: string | null) => {
      setLoading(true);
      const r = await apiGet<{ items: LibraryFile[]; nextCursor: string | null }>("/api/v1/filing/files", {
        folder: onlyFolder ? folder : undefined,
        type: mode === "image" ? "image" : "document",
        q: q || undefined,
        limit: 24,
        cursor: after ?? undefined,
      });
      setLoading(false);
      if (!r.ok) return setError(r.error);
      setError(null);
      const data = r.data as { items: LibraryFile[]; nextCursor: string | null };
      setItems((prev) => (after && prev ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    },
    [folder, onlyFolder, mode, q],
  );

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = (f: LibraryFile) =>
    setPicked((p) => (p.some((x) => x.id === f.id) ? p.filter((x) => x.id !== f.id) : multiple ? (p.length < room ? [...p, f] : p) : [f]));

  const confirm = () =>
    onAdd(
      picked.map((f) => f.url),
      Object.fromEntries(picked.map((f) => [f.url, { name: f.name, size: f.size, openHref: `/api/v1/filing/files/${f.id}?open=1` }])),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="Search files by name"
            placeholder="Search by file name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 w-full rounded-[var(--radius-input)] border border-line-strong bg-white pr-3 pl-9 text-sm focus:border-charcoal focus:ring-3 focus:ring-brand/35 focus:outline-none"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-charcoal" checked={onlyFolder} onChange={(e) => setOnlyFolder(e.target.checked)} />
          Only <span className="num text-xs">{folder}</span>
        </label>
      </div>
      {error?.code === "FORBIDDEN" ? (
        <p className="rounded-[12px] bg-canvas px-4 py-6 text-center text-sm text-muted">You don&apos;t have access to the file library.</p>
      ) : error ? (
        <p className="rounded-[12px] bg-danger-tint px-4 py-3 text-sm text-danger" role="alert">
          {error.message}
        </p>
      ) : items === null ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading files">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[12px] bg-line/70" />
          ))}
        </div>
      ) : !items.length ? (
        <p className="blueprint rounded-[12px] border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">No {mode === "image" ? "images" : "documents"} {onlyFolder ? `in ${folder}` : "yet"}. Upload one in the other tab.</p>
      ) : (
        <ul className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((f) => {
            const on = picked.some((x) => x.id === f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f)}
                  className={cn("relative block w-full overflow-hidden rounded-[12px] border text-left transition-shadow", on ? "border-charcoal ring-3 ring-brand" : "border-line hover:border-ink/30")}
                >
                  {mode === "image" && f.access === "PUBLIC" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" loading="lazy" className="aspect-square w-full bg-canvas object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center bg-canvas text-muted">
                      <FileText className="h-6 w-6" />
                    </span>
                  )}
                  <span className="block truncate px-2 pt-1.5 text-xs font-medium">{f.name}</span>
                  <span className="num block px-2 pb-1.5 text-[10px] text-muted">{formatBytes(f.size)}</span>
                  {on && (
                    <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-charcoal text-brand">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {cursor ? (
          <button type="button" onClick={() => load(cursor)} disabled={loading} className="text-sm font-medium underline-offset-2 hover:underline">
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!picked.length}
          onClick={confirm}
          className="inline-flex h-10 items-center rounded-[var(--radius-input)] border border-brand-hover/40 bg-brand px-4 text-sm font-semibold text-charcoal hover:bg-brand-hover disabled:opacity-50"
        >
          {picked.length ? `Use ${picked.length} selected` : "Select files"}
        </button>
      </div>
    </div>
  );
}
