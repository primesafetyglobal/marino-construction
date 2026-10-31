import Link from "next/link";
import { Plus } from "lucide-react";
import { SupplyOrdersList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listSupplyOrders } from "@/server/modules/operations/supply-order/supply-order.queries";

export const metadata = { title: "Supply orders" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "status", "handler"]);
  const page = await listSupplyOrders.page(params);
  return (
    <>
      <PageHeader
        title="Supply orders"
        actions={
          <Link href="/admin/requests/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New request
          </Link>
        }
      />
      <SupplyOrdersList initial={jsonify(page)} params={params} />
    </>
  );
}
