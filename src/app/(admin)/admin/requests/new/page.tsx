import { NewRequestForm } from "@/components/admin/new-request";
import { PageHeader, Panel } from "@/components/admin/ui";
import { NoAccess } from "@/components/ui/states";
import { hasAnyPermission, requireUser } from "@/server/validation/auth";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  const user = await requireUser();
  if (!hasAnyPermission(user, ["equipment-request:create", "supply-order:create", "service-request:create", "workforce-request:create"])) return <NoAccess />;
  return (
    <>
      <PageHeader title="New request" subtitle="For phone, WhatsApp and walk-in clients." />
      <Panel className="max-w-3xl">
        <NewRequestForm />
      </Panel>
    </>
  );
}
