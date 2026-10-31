import { HandlerPicker, StatusStepper } from "@/components/admin/actions";
import { ApplicantsTable } from "@/components/admin/applicants-table";
import { ClientCard } from "@/components/admin/cards";
import { JobPostPanel, WorkforceRequestForm } from "@/components/admin/request-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { formatDateTime, humanize } from "@/lib/format";
import { jsonify } from "@/server/core/result";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { getWorkforceRequest } from "@/server/modules/operations/workforce-request/workforce-request.queries";
import { getApplicationsByRequest } from "@/server/modules/operations/job-application/job-application.queries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, user] = await Promise.all([getWorkforceRequest.page({ id }), requireUser()]);
  const applications = await getApplicationsByRequest.page({ workforceRequestId: id });
  return (
    <>
      <PageHeader
        back={{ href: "/admin/workforce-requests", label: "Workforce requests" }}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{r.code}</span> <StatusPill status={r.status} />
          </span>
        }
        subtitle={`${r.quantity} × ${r.role} · ${r.duration} · ${humanize(r.source)} · ${formatDateTime(r.createdAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Status">
            <StatusStepper kind="workforce" requestId={r.id} status={r.status} path={["NEW", "RECRUITING", "FILLED"]} moves={r.can.moves} />
          </Panel>
          <Panel title="Job post">
            <JobPostPanel r={r} canPublish={r.can.publish} />
          </Panel>
          <Panel title={`Applicants (${applications.items.length})`}>
            <ApplicantsTable items={jsonify(applications.items)} canUpdate={hasPermission(user, "job-application:update")} canDelete={hasPermission(user, "job-application:delete")} />
          </Panel>
          <Panel title="Request details">
            <WorkforceRequestForm r={r} canEdit={r.can.update} />
          </Panel>
        </div>
        <div className="space-y-6">
          <ClientCard client={r.client} />
          <Panel title="Handled by">
            <HandlerPicker kind="workforce" requestId={r.id} current={r.handledBy} me={{ id: user.id, name: user.name }} canEdit={r.can.update} />
          </Panel>
        </div>
      </div>
    </>
  );
}
