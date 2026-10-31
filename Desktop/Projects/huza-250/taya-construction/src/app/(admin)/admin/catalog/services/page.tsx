import Link from "next/link";
import { Plus } from "lucide-react";
import { CatalogList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { listServicesAdmin } from "@/server/modules/catalog/service/service.queries";

export const metadata = { title: "Services" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "division"]);
  const [page, user] = await Promise.all([listServicesAdmin.page(params), requireUser()]);
  return (
    <>
      <PageHeader
        title="Services"
        actions={
          hasPermission(user, "service:create") ? (
            <Link href="/admin/catalog/services/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New
            </Link>
          ) : null
        }
      />
      <CatalogList kind="services" initial={jsonify(page)} params={params} />
    </>
  );
}
