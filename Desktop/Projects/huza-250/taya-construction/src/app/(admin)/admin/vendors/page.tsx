import { VendorsList } from "@/components/admin/lists";
import { VendorFormButton } from "@/components/admin/party-forms";
import { PageHeader } from "@/components/admin/ui";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { listVendors } from "@/server/modules/parties/vendor/vendor.queries";

export const metadata = { title: "Vendors" };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q", "type", "status", "district", "partner"]);
  const page = await listVendors.page(params);
  return (
    <>
      <PageHeader title="Vendors" subtitle="Equipment owners, suppliers, garages, technicians, contractors and recyclers." actions={<VendorFormButton label="New vendor" uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />} />
      <VendorsList initial={jsonify(page)} params={params} />
    </>
  );
}
