import Link from "next/link";
import { ActionButton } from "@/components/admin/actions";
import { ClientFormButton } from "@/components/admin/party-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { formatDate, formatPhone, formatRwf, humanize } from "@/lib/format";
import { deleteClient } from "@/server/modules/parties/client/client.actions";
import { getClient } from "@/server/modules/parties/client/client.queries";

const code = (p: string, n: number) => `${p}-${String(n).padStart(4, "0")}`;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClient.page({ id });
  const requests = [
    ...c.equipmentRequests.map((r) => ({ id: r.id, code: code("EQ", r.number), href: `/admin/equipment-requests/${r.id}`, title: `${r.type === "RENT" ? "Rent" : "Buy"} · ${r.equipment?.name ?? "Sourcing"}`, status: r.status, createdAt: r.createdAt })),
    ...c.supplyOrders.map((r) => ({ id: r.id, code: code("SO", r.number), href: `/admin/supply-orders/${r.id}`, title: r.items, status: r.status, createdAt: r.createdAt })),
    ...c.serviceRequests.map((r) => ({ id: r.id, code: code("SR", r.number), href: `/admin/service-requests/${r.id}`, title: r.service.name, status: r.status, createdAt: r.createdAt })),
    ...c.workforceRequests.map((r) => ({ id: r.id, code: code("WR", r.number), href: `/admin/workforce-requests/${r.id}`, title: r.role, status: r.status, createdAt: r.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <>
      <PageHeader
        back={{ href: "/admin/clients", label: "Clients" }}
        title={c.companyName ?? c.name}
        subtitle={`${humanize(c.entityType)} · client since ${formatDate(c.createdAt)}`}
        actions={
          <>
            <ClientFormButton label="Edit" client={{ ...c, id: c.id }} />
            {c.can.delete && (
              <ActionButton variant="danger" confirm="Delete this client? This cannot be undone." action={deleteClient.bind(null, { id: c.id })} redirectTo="/admin/clients" success="Client deleted.">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel title="Profile">
          <DefList
            rows={[
              ["Name", c.name],
              ["Company", c.companyName],
              ["TIN", c.tin],
              ["Phone", formatPhone(c.phone)],
              ["Email", c.email],
              ["District", c.district],
              ["Notes", c.notes],
            ]}
          />
        </Panel>
        <div className="space-y-6">
          <Panel title={`Requests (${requests.length})`}>
            {requests.length ? (
              <ul className="divide-y divide-line/50">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="flex items-center gap-3 py-2.5 text-sm hover:bg-mist/50">
                      <span className="w-20 font-mono font-semibold">{r.code}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                      <StatusPill status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No requests yet.</p>
            )}
          </Panel>
          <Panel title="Payments">
            {c.payments.length ? (
              <ul className="divide-y divide-line/50 text-sm">
                {c.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="w-32 font-semibold">{formatRwf(p.amount)}</span>
                    <span className="font-mono text-muted">
                      {p.equipmentRequest ? code("EQ", p.equipmentRequest.number) : p.supplyOrder ? code("SO", p.supplyOrder.number) : p.serviceRequest ? code("SR", p.serviceRequest.number) : ""}
                    </span>
                    <span className="flex-1 text-muted">{p.status === "PAID" ? `Paid ${formatDate(p.paidAt)}` : `Due ${formatDate(p.dueDate)}`}</span>
                    <StatusPill status={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No payments yet.</p>
            )}
          </Panel>
          <Panel title="Reviews">
            {c.reviews.length ? (
              <ul className="space-y-3">
                {c.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-mist p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} size={14} />
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-1">{r.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No reviews.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
