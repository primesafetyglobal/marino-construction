"use client";
// Settings tab (Filing guide §13): max upload, allowed types, folder rules
// (folder, types, max MB, access), presign expiry. Same Zod schema as the server.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useActionForm } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { updateFileSettings } from "@/server/modules/filing/file-settings/file-settings.actions";
import { updateSettingsSchema } from "@/server/modules/filing/file-settings/file-settings.schema";
import type { SettingsDto } from "@/server/modules/filing/file-settings/file-settings.select";
import type { Jsonify } from "@/server/core/result";

type Rule = { folder: string; mimeTypes: string; maxMb: string; access: "" | "PUBLIC" | "PRIVATE" };

const lines = (v: string) =>
  v
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export function SettingsTab({ initial, canEdit }: { initial: Jsonify<SettingsDto>; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [maxUploadMb, setMax] = useState(String(initial.maxUploadMb));
  const [presign, setPresign] = useState(String(initial.presignExpirySec));
  const [types, setTypes] = useState(initial.allowedMimeTypes.join("\n"));
  const [rules, setRules] = useState<Rule[]>(
    Object.entries(initial.folderRules ?? {}).map(([folder, r]) => ({ folder, mimeTypes: (r.mimeTypes ?? []).join(", "), maxMb: r.maxMb ? String(r.maxMb) : "", access: r.access ?? "" })),
  );
  const form = useActionForm<SettingsDto>();
  const setRule = (i: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const folderRules = Object.fromEntries(
      rules
        .filter((r) => r.folder.trim())
        .map((r) => [
          r.folder.trim(),
          { ...(lines(r.mimeTypes).length ? { mimeTypes: lines(r.mimeTypes) } : {}), ...(r.maxMb ? { maxMb: Number(r.maxMb) } : {}), ...(r.access ? { access: r.access } : {}) },
        ]),
    );
    const res = await form.run({
      schema: updateSettingsSchema,
      action: updateFileSettings,
      input: { maxUploadMb: Number(maxUploadMb), presignExpirySec: Number(presign), allowedMimeTypes: lines(types), folderRules: Object.keys(folderRules).length ? folderRules : null },
    });
    if (res) {
      toast("success", "Settings saved. Uploads use them within a minute.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Max upload (MB)" hint="Applies to every folder; a folder rule can only lower it." error={form.errors.maxUploadMb}>
            <Input placeholder="e.g. 10" type="number" min={1} value={maxUploadMb} disabled={!canEdit} onChange={(e) => setMax(e.target.value)} />
          </Field>
          <Field label="Temporary link expiry (seconds)" hint="Presigned uploads and private file links." error={form.errors.presignExpirySec}>
            <Input placeholder="https://example.rw" type="number" min={60} value={presign} disabled={!canEdit} onChange={(e) => setPresign(e.target.value)} />
          </Field>
        </div>
        <Field label="Allowed types" hint="One MIME type per line. SVG can carry scripts: allow it only in folders used by trusted staff." error={form.errors.allowedMimeTypes} className="mt-4">
          <Textarea placeholder={"image/jpeg\napplication/pdf"} rows={6} value={types} disabled={!canEdit} onChange={(e) => setTypes(e.target.value)} className="font-mono text-xs" />
        </Field>
      </Panel>
      <Panel
        title="Folder rules"
        actions={
          canEdit ? (
            <Button size="sm" variant="outline" onClick={() => setRules((r) => [...r, { folder: "", mimeTypes: "", maxMb: "", access: "" }])}>
              <Plus className="h-4 w-4" /> Add rule
            </Button>
          ) : undefined
        }
      >
        <p className="mb-3 text-sm text-muted">A rule applies to the folder and its sub-folders. A PRIVATE folder needs an active private storage, otherwise its uploads are refused.</p>
        <ul className="space-y-3">
          {rules.map((r, i) => (
            <li key={i} className="grid gap-2 rounded-2xl border border-line/60 p-3 sm:grid-cols-[1fr_2fr_90px_130px_auto] sm:items-end">
              <Field label="Folder">
                <Input placeholder="e.g. site-photos" value={r.folder} disabled={!canEdit} onChange={(e) => setRule(i, { folder: e.target.value })} />
              </Field>
              <Field label="Types" hint="Empty = allowed types">
                <Input placeholder="image/jpeg, image/png" value={r.mimeTypes} disabled={!canEdit} onChange={(e) => setRule(i, { mimeTypes: e.target.value })} />
              </Field>
              <Field label="Max MB">
                <Input placeholder="e.g. 10" type="number" min={1} value={r.maxMb} disabled={!canEdit} onChange={(e) => setRule(i, { maxMb: e.target.value })} />
              </Field>
              <Field label="Access">
                <Select value={r.access} disabled={!canEdit} onChange={(e) => setRule(i, { access: e.target.value as Rule["access"] })}>
                  <option value="">Public (default)</option>
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </Select>
              </Field>
              {canEdit && (
                <button aria-label="Remove rule" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 text-danger hover:bg-danger-tint">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {form.errors.folderRules && <p className="mt-2 text-xs text-danger">{form.errors.folderRules[0]}</p>}
      </Panel>
      <FormError message={form.formError?.message} />
      {canEdit && (
        <div className="flex justify-end">
          <Button disabled={form.pending} onClick={save}>
            Save settings
          </Button>
        </div>
      )}
    </div>
  );
}
