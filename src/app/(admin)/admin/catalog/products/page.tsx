import Link from "next/link";
import { Plus } from "lucide-react";
import { CatalogList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { listProductsAdmin } from "@/server/modules/catalog/product/product.queries";

export const metadata = { title: "Products" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "category"]);
  const [page, user] = await Promise.all([listProductsAdmin.page(params), requireUser()]);
  return (
    <>
      <PageHeader
        title="Products"
        actions={
          hasPermission(user, "product:create") ? (
            <Link href="/admin/catalog/products/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New
            </Link>
          ) : null
        }
      />
      <CatalogList kind="products" initial={jsonify(page)} params={params} can={{ update: hasPermission(user, "product:update"), approve: hasPermission(user, "equipment:approve"), delete: hasPermission(user, "product:delete") }} />
    </>
  );
}
