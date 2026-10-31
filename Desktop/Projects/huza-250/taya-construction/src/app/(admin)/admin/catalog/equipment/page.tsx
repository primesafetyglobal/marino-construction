import Link from "next/link";
import { Plus } from "lucide-react";
import { CatalogList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { listEquipmentAdmin } from "@/server/modules/catalog/equipment/equipment.queries";

export const metadata = { title: "Equipment" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "status", "mode", "category"]);
  const [page, user] = await Promise.all([listEquipmentAdmin.page(params), requireUser()]);
  return (
    <>
      <PageHeader
        title="Equipment"
        actions={
          hasPermission(user, "equipment:create") ? (
            <Link href="/admin/catalog/equipment/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New
            </Link>
          ) : null
        }
      />
      <CatalogList kind="equipment" initial={jsonify(page)} params={params} can={{ update: hasPermission(user, "equipment:update"), approve: hasPermission(user, "equipment:approve"), delete: hasPermission(user, "equipment:delete") }} />
    </>
  );
}
