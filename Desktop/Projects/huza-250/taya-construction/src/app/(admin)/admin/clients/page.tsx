import { ClientsList } from "@/components/admin/lists";
import { ClientFormButton } from "@/components/admin/party-forms";
import { PageHeader } from "@/components/admin/ui";
import { flatParams, type RawSearchParams } from "@/lib/params";
import { jsonify } from "@/server/core/result";
import { listClients } from "@/server/modules/parties/client/client.queries";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = flatParams(await searchParams, ["q"]);
  const page = await listClients.page(params);
  return (
    <>
      <PageHeader title="Clients" actions={<ClientFormButton />} />
      <ClientsList initial={jsonify(page)} params={params} />
    </>
  );
}
