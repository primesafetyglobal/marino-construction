import Link from "next/link";
import { Plus } from "lucide-react";
import { ServiceRequestsList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listServiceRequests } from "@/server/modules/operations/service-request/service-request.queries";

export const metadata = { title: "Service requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "status", "division", "service", "handler"]);
  const page = await listServiceRequests.page(params);
  return (
    <>
      <PageHeader
        title="Service requests"
        actions={
          <Link href="/admin/requests/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New request
          </Link>
        }
      />
      <ServiceRequestsList initial={jsonify(page)} params={params} />
    </>
  );
}
