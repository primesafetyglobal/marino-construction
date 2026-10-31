import { HandlerPicker, StatusStepper } from "@/components/admin/actions";
import { ClientCard } from "@/components/admin/cards";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { EquipmentRequestForm } from "@/components/admin/request-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { formatDateTime, humanize } from "@/lib/format";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { getEquipmentRequest } from "@/server/modules/operations/equipment-request/equipment-request.queries";
import { getPaymentsByRequest } from "@/server/modules/parties/payment/payment.queries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, user] = await Promise.all([getEquipmentRequest.page({ id }), requireUser()]);
  const payments = hasPermission(user, "payment:read") ? await getPaymentsByRequest.page({ requestType: "EQUIPMENT_REQUEST", requestId: id }) : null;
  const path = r.type === "RENT" ? ["NEW", "QUOTED", "CONFIRMED", "ACTIVE", "COMPLETED"] : ["NEW", "QUOTED", "CONFIRMED", "COMPLETED"];
  return (
    <>
      <PageHeader
        back={{ href: "/admin/equipment-requests", label: "Equipment requests" }}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{r.code}</span> <StatusPill status={r.status} />
          </span>
        }
        subtitle={`${r.type === "RENT" ? "Rent" : "Buy"} · ${r.equipment?.name ?? "Sourcing request"} · ${humanize(r.source)} · ${formatDateTime(r.createdAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Status">
            <StatusStepper kind="equipment" requestId={r.id} status={r.status} path={path} moves={r.can.moves} />
          </Panel>
          <Panel title="Request details">
            <EquipmentRequestForm r={r} canEdit={r.can.update} />
          </Panel>
        </div>
        <div className="space-y-6">
          <ClientCard client={r.client} />
          <Panel title="Handled by">
            <HandlerPicker kind="equipment" requestId={r.id} current={r.handledBy} me={{ id: user.id, name: user.name }} canEdit={r.can.update} />
          </Panel>
          {r.equipment && (
            <Panel title="Equipment">
              <DefList rows={[["Item", <a key="e" href={`/admin/catalog/equipment/${r.equipment.id}`} className="font-semibold hover:underline">{r.equipment.name}</a>], ["Status", <StatusPill key="s" status={r.equipment.status} />]]} />
            </Panel>
          )}
          {payments && (
            <Panel title="Payments">
              <PaymentsPanel requestType="EQUIPMENT_REQUEST" requestId={r.id} data={jsonify(payments)} canRecord={hasPermission(user, "payment:record")} canDelete={hasPermission(user, "payment:delete")} installmentsAllowed={false} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
