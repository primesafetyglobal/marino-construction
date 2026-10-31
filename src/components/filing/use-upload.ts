"use client";
// useUpload (Filing guide §13, §14.2 B): request a presigned PUT, upload the
// file straight to storage with progress, then confirm. Returns the registered
// file, whose `url` is the value to store. CLIENT-SAFE.

import { useCallback, useState } from "react";
import { confirmFileUpload, requestFileUpload } from "@/server/modules/filing/file/file.actions";
import { requestUploadSchema } from "@/server/modules/filing/file/file.schema";
import type { FileDto } from "@/server/modules/filing/file/file.select";

export type UploadState = { name: string; progress: number; status: "uploading" | "done" | "error"; error?: string; file?: FileDto };

function put(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection, or the storage CORS rule."));
    xhr.send(file);
  });
}

export function useUpload(opts: { folder?: string | null; onUploaded?: (f: FileDto) => void } = {}) {
  const [items, setItems] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const { folder, onUploaded } = opts;

  const upload = useCallback(
    async (files: File[] | FileList, override?: { folder?: string | null }): Promise<FileDto[]> => {
      const list = Array.from(files);
      const target = override?.folder !== undefined ? override.folder : (folder ?? null);
      setBusy(true);
      const start = items.length;
      setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, progress: 0, status: "uploading" as const }))]);
      const set = (i: number, patch: Partial<UploadState>) => setItems((prev) => prev.map((x, j) => (j === start + i ? { ...x, ...patch } : x)));
      const done: FileDto[] = [];
      for (const [i, file] of list.entries()) {
        try {
          const input = { name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, folder: target };
          const check = requestUploadSchema.safeParse(input);
          if (!check.success) throw new Error(check.error.issues[0]?.message ?? "Invalid file.");
          const ticket = await requestFileUpload(input);
          if (!ticket.ok) throw new Error(ticket.error.message);
          await put(ticket.data.uploadUrl, ticket.data.headers, file, (pct) => set(i, { progress: pct }));
          const confirmed = await confirmFileUpload({ key: ticket.data.key, storageId: ticket.data.storageId, name: file.name, folder: target });
          if (!confirmed.ok) throw new Error(confirmed.error.message);
          set(i, { progress: 100, status: "done", file: confirmed.data });
          done.push(confirmed.data);
          onUploaded?.(confirmed.data);
        } catch (e) {
          set(i, { status: "error", error: (e as Error).message });
        }
      }
      setBusy(false);
      return done;
    },
    [folder, onUploaded, items.length],
  );

  return { upload, items, busy, clear: () => setItems([]) };
}
