import Link from "next/link";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/admin/ui";
import { NoAccess } from "@/components/ui/states";
import { BackupsTab } from "@/components/filing/backups-tab";
import { FilesTab } from "@/components/filing/files-tab";
import { HealthTab } from "@/components/filing/health-tab";
import { SettingsTab } from "@/components/filing/settings-tab";
import type { FilingCan } from "@/components/filing/shared";
import { StorageTab } from "@/components/filing/storage-tab";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser, type SessionUser } from "@/server/validation/auth";
import { listBackups } from "@/server/modules/filing/file-backup/file-backup.queries";
import { getFileSettings } from "@/server/modules/filing/file-settings/file-settings.queries";
import { listStorages } from "@/server/modules/filing/file-storage/file-storage.queries";
import { getFileStats, listFileFolders, listFiles } from "@/server/modules/filing/file/file.queries";

export const metadata = { title: "Files" };

const TABS = [
  { value: "files", label: "Files", key: "file:read" },
  { value: "backups", label: "Backups", key: "file-backup:read" },
  { value: "storage", label: "Storage", key: "file-storage:read" },
  { value: "health", label: "Health", key: "file:read" },
  { value: "settings", label: "Settings", key: "file-settings:read" },
] as const;

function canOf(user: SessionUser): FilingCan {
  const h = (k: `${string}:${string}`) => hasPermission(user, k);
  return {
    fileRead: h("file:read"),
    fileCreate: h("file:create"),
    fileUpdate: h("file:update"),
    fileDelete: h("file:delete"),
    storageRead: h("file-storage:read"),
    storageCreate: h("file-storage:create"),
    storageUpdate: h("file-storage:update"),
    storageDelete: h("file-storage:delete"),
    settingsRead: h("file-settings:read"),
    settingsUpdate: h("file-settings:update"),
    backupRead: h("file-backup:read"),
    backupCreate: h("file-backup:create"),
    backupDelete: h("file-backup:delete"),
  };
}

// Files (file:read), Backups, Storage and Settings need their own keys; tabs a
// role cannot open are not shown, and every query checks again.
export default async function FilingPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const can = canOf(user);
  const tabs = TABS.filter((t) => hasPermission(user, t.key));
  if (!tabs.length) return <NoAccess />;
  const tab = tabs.find((t) => t.value === sp.tab) ?? tabs[0];

  let body: React.ReactNode;
  if (tab.value === "files") {
    const params = flatParams(sp, ["q", "folder", "status", "storageId", "type", "from", "to", "sort", "dir"]);
    const [page, folders, storages, limits] = await Promise.all([
      listFiles.page(params),
      listFileFolders.page({}),
      can.storageRead ? listStorages.page({}) : Promise.resolve([]),
      can.fileCreate || can.settingsRead ? getFileSettings.page({}) : Promise.resolve(null),
    ]);
    body = (
      <FilesTab
        initial={jsonify(page)}
        params={params}
        folders={folders}
        storages={storages.map((s) => ({ id: s.id, name: s.name }))}
        limits={limits ? { maxUploadMb: limits.maxUploadMb, allowedMimeTypes: limits.allowedMimeTypes, folderRules: limits.folderRules } : null}
        can={can}
      />
    );
  } else if (tab.value === "backups") {
    body = <BackupsTab initial={jsonify(await listBackups.page({ limit: 50 }))} can={can} />;
  } else if (tab.value === "storage") {
    body = <StorageTab initial={jsonify(await listStorages.page({}))} can={can} />;
  } else if (tab.value === "health") {
    const [stats, storages] = await Promise.all([getFileStats.page({}), can.storageRead ? listStorages.page({}) : Promise.resolve([])]);
    body = <HealthTab stats={stats} storages={storages.map((s) => ({ id: s.id, name: s.name }))} can={can} />;
  } else {
    body = <SettingsTab initial={jsonify(await getFileSettings.page({}))} canEdit={can.settingsUpdate} />;
  }

  return (
    <>
      <PageHeader title="Files" subtitle="Every stored file, its storage, backups and health checks." />
      <nav aria-label="Files sections" className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-line/60 bg-white p-1 shadow-soft">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/admin/filing?tab=${t.value}`}
            aria-current={t.value === tab.value ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors", t.value === tab.value ? "bg-charcoal text-white" : "text-muted hover:bg-mist hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
