import Link from "next/link";
import { Plus } from "lucide-react";
import { EquipmentRequestsList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listEquipmentRequests } from "@/server/modules/operations/equipment-request/equipment-request.queries";

export const metadata = { title: "Equipment requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "status", "type", "handler"]);
  const page = await listEquipmentRequests.page(params);
  return (
    <>
      <PageHeader
        title="Equipment requests"
        actions={
          <Link href="/admin/requests/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New request
          </Link>
        }
      />
      <EquipmentRequestsList initial={jsonify(page)} params={params} />
    </>
  );
}
