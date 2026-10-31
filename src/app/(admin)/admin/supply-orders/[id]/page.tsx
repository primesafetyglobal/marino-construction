import { HandlerPicker, StatusStepper, VendorPicker } from "@/components/admin/actions";
import { ClientCard } from "@/components/admin/cards";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { SupplyOrderForm } from "@/components/admin/request-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { formatDateTime, humanize } from "@/lib/format";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { getSupplyOrder } from "@/server/modules/operations/supply-order/supply-order.queries";
import { getPaymentsByRequest } from "@/server/modules/parties/payment/payment.queries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, user] = await Promise.all([getSupplyOrder.page({ id }), requireUser()]);
  const payments = hasPermission(user, "payment:read") ? await getPaymentsByRequest.page({ requestType: "SUPPLY_ORDER", requestId: id }) : null;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/supply-orders", label: "Supply orders" }}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{r.code}</span> <StatusPill status={r.status} />
          </span>
        }
        subtitle={`${r.product?.name ?? "Materials"} · ${humanize(r.source)} · ${formatDateTime(r.createdAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Status">
            <StatusStepper kind="supply" requestId={r.id} status={r.status} path={["NEW", "QUOTED", "CONFIRMED", "DELIVERED"]} moves={r.can.moves} />
          </Panel>
          <Panel title="Order details">
            <SupplyOrderForm r={r} canEdit={r.can.update} />
          </Panel>
        </div>
        <div className="space-y-6">
          <ClientCard client={r.client} />
          <Panel title="Handled by">
            <HandlerPicker kind="supply" requestId={r.id} current={r.handledBy} me={{ id: user.id, name: user.name }} canEdit={r.can.update} />
          </Panel>
          <Panel title="Supplier (vendor)">
            <VendorPicker kind="supply" requestId={r.id} current={r.vendor} canEdit={r.can.update} />
          </Panel>
          {payments && (
            <Panel title="Payments">
              <PaymentsPanel requestType="SUPPLY_ORDER" requestId={r.id} data={jsonify(payments)} canRecord={hasPermission(user, "payment:record")} canDelete={hasPermission(user, "payment:delete")} installmentsAllowed={false} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
