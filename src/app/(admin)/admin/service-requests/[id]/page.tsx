import { divisionByEnum } from "@/config/divisions";
import { HandlerPicker, StatusStepper, VendorPicker } from "@/components/admin/actions";
import { ClientCard } from "@/components/admin/cards";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { ServiceRequestForm } from "@/components/admin/request-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge, StatusPill } from "@/components/ui/badge";
import { formatDateTime, humanize } from "@/lib/format";
import { jsonify } from "@/server/core/result";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { getServiceRequest } from "@/server/modules/operations/service-request/service-request.queries";
import { getPaymentsByRequest } from "@/server/modules/parties/payment/payment.queries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, user] = await Promise.all([getServiceRequest.page({ id }), requireUser()]);
  const payments = hasPermission(user, "payment:read") ? await getPaymentsByRequest.page({ requestType: "SERVICE_REQUEST", requestId: id }) : null;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/service-requests", label: "Service requests" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{r.code}</span> <StatusPill status={r.status} />
            {r.paymentPlan === "INSTALLMENT" && <Badge tone="brand">Pay later · installments</Badge>}
          </span>
        }
        subtitle={`${r.service.name} · ${divisionByEnum(r.service.category.division)?.name} · ${humanize(r.source)} · ${formatDateTime(r.createdAt)}${r.deliveredAt ? ` · delivered ${formatDateTime(r.deliveredAt)}` : ""}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Status">
            <StatusStepper kind="service" requestId={r.id} status={r.status} path={["NEW", "QUOTED", "SCHEDULED", "IN_PROGRESS", "DELIVERED"]} moves={r.can.moves} />
          </Panel>
          <Panel title="Request details">
            <ServiceRequestForm r={r} canEdit={r.can.update} uploadsEnabled={(await hasActiveStorage("PRIVATE"))} />
          </Panel>
        </div>
        <div className="space-y-6">
          <ClientCard client={r.client} />
          <Panel title="Handled by">
            <HandlerPicker kind="service" requestId={r.id} current={r.handledBy} me={{ id: user.id, name: user.name }} canEdit={r.can.update} />
          </Panel>
          <Panel title="Vendor (technician, contractor, recycler)">
            <VendorPicker kind="service" requestId={r.id} current={r.vendor} canEdit={r.can.update} />
          </Panel>
          {payments && (
            <Panel title="Payments">
              <PaymentsPanel
                requestType="SERVICE_REQUEST"
                requestId={r.id}
                data={jsonify(payments)}
                canRecord={hasPermission(user, "payment:record")}
                canDelete={hasPermission(user, "payment:delete")}
                installmentsAllowed={r.paymentPlan === "INSTALLMENT" && r.quotedAmount !== null}
              />
              {r.paymentPlan === "INSTALLMENT" && r.quotedAmount === null && <p className="mt-3 text-xs text-warning">Enter the quoted amount to plan installments.</p>}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
