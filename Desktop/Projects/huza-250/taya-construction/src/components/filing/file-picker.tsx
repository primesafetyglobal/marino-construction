"use client";
// <FilePicker /> (Filing guide §14.2 E): pick an existing file, or upload one,
// for other modules' forms. Gives back the file; store its `url`.
//
//   <FilePicker folder="vendor-logos" accept="image/*" onSelect={(f) => setLogo(f.url)} />

import { useEffect, useState } from "react";
import { FileText, Loader2, Search, Upload } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import type { FileDto } from "@/server/modules/filing/file/file.select";
import type { Jsonify } from "@/server/core/result";
import { formatBytes } from "./shared";
import { useUpload } from "./use-upload";

type F = Jsonify<FileDto>;

export function FilePicker({
  folder,
  accept,
  onSelect,
  label = "Choose file",
  canUpload = true,
}: {
  folder?: string;
  accept?: string; // "image/*" or a comma list of MIME types
  onSelect: (file: F) => void;
  label?: string;
  canUpload?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<F[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, busy, items: uploads } = useUpload({ folder: folder ?? null });
  const type = accept?.startsWith("image/") ? "image" : undefined;

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const t = setTimeout(() => {
      apiGet<{ items: F[] }>("/api/v1/filing/files", { folder, q: q || undefined, type, limit: 40 }).then((r) => {
        if (stop) return;
        if (!r.ok) setError(r.error.message);
        else setItems((r.data as { items: F[] }).items);
      });
    }, 200);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [open, q, folder, type]);

  const pick = (f: F) => {
    onSelect(f);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={folder ? `Files in ${folder}` : "Files"}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {canUpload && (
              <label className={cn("inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-charcoal", busy && "opacity-60")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                <input
                  type="file"
                  className="sr-only"
                  accept={accept}
                  disabled={busy}
                  onChange={async (e) => {
                    const done = e.target.files ? await upload(e.target.files) : [];
                    if (done[0]) pick(done[0] as unknown as F);
                  }}
                />
              </label>
            )}
          </div>
          {uploads.some((u) => u.error) && <p className="text-xs text-danger">{uploads.find((u) => u.error)?.error}</p>}
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : !items.length ? (
            <p className="text-sm text-muted">No files yet.</p>
          ) : (
            <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {items.map((f) => (
                <li key={f.id}>
                  <button onClick={() => pick(f)} className="block w-full overflow-hidden rounded-xl border border-line/60 text-left hover:ring-2 hover:ring-brand">
                    {f.mimeType.startsWith("image/") && f.access === "PUBLIC" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt="" loading="lazy" className="aspect-square w-full bg-mist object-cover" />
                    ) : (
                      <span className="flex aspect-square items-center justify-center bg-mist text-muted">
                        <FileText className="h-6 w-6" />
                      </span>
                    )}
                    <span className="block truncate px-2 py-1 text-xs">{f.name}</span>
                    <span className="block px-2 pb-1 text-[10px] text-muted">{formatBytes(f.size)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}
