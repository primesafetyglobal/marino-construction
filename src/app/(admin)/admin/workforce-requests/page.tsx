import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkforceRequestsList } from "@/components/admin/lists";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listWorkforceRequests } from "@/server/modules/operations/workforce-request/workforce-request.queries";

export const metadata = { title: "Workforce requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "status", "published", "handler"]);
  const page = await listWorkforceRequests.page(params);
  return (
    <>
      <PageHeader
        title="Workforce requests"
        actions={
          <Link href="/admin/requests/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New request
          </Link>
        }
      />
      <WorkforceRequestsList initial={jsonify(page)} params={params} />
    </>
  );
}
