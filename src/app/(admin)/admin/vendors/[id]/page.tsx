import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ActionButton } from "@/components/admin/actions";
import { VendorFormButton } from "@/components/admin/party-forms";
import { DefList, PageHeader, Panel } from "@/components/admin/ui";
import { Badge, StatusPill } from "@/components/ui/badge";
import { formatDate, formatPhone, humanize } from "@/lib/format";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { deleteVendor, setVendorPartner, setVendorStatus } from "@/server/modules/parties/vendor/vendor.actions";
import { getVendor } from "@/server/modules/parties/vendor/vendor.queries";

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getVendor.page({ id });
  return (
    <>
      <PageHeader
        back={{ href: "/admin/vendors", label: "Vendors" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {v.companyName ?? v.name} <StatusPill status={v.status} />
            {v.isPartner && (
              <Badge tone="brand" icon={<BadgeCheck className="h-3 w-3" />}>
                Approved Partner
              </Badge>
            )}
          </span>
        }
        subtitle={`${humanize(v.type)} · since ${formatDate(v.createdAt)}`}
        actions={
          <>
            {v.can.approve && (
              <ActionButton variant="primary" action={setVendorStatus.bind(null, { id: v.id, status: "APPROVED" })} success="Vendor approved." testId="vendor-approve">
                Approve
              </ActionButton>
            )}
            {v.can.deactivate && (
              <ActionButton variant="outline" confirm="Deactivate this vendor? It can no longer be linked to requests." action={setVendorStatus.bind(null, { id: v.id, status: "INACTIVE" })} success="Vendor deactivated.">
                Deactivate
              </ActionButton>
            )}
            {v.can.partner && (
              <ActionButton variant="dark" action={setVendorPartner.bind(null, { id: v.id, isPartner: !v.isPartner })} success={v.isPartner ? "Partner badge removed." : "Marked as partner."} testId="vendor-partner">
                {v.isPartner ? "Remove partner badge" : "Mark as partner"}
              </ActionButton>
            )}
            <VendorFormButton label="Edit" vendor={{ ...v }} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />
            {v.can.delete && (
              <ActionButton variant="danger" confirm="Delete this vendor?" action={deleteVendor.bind(null, { id: v.id })} redirectTo="/admin/vendors" success="Vendor deleted.">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Profile">
          <DefList
            rows={[
              ["Contact", v.name],
              ["Company", v.companyName],
              ["TIN", v.tin],
              ["Phone", formatPhone(v.phone)],
              ["Email", v.email],
              ["District", v.district],
              ["Offers", v.offerings],
              ["Website", v.website ? <a key="w" href={v.website} className="underline" target="_blank" rel="noreferrer">{v.website}</a> : null],
              ["Logo", v.logo ? "Uploaded" : "-"],
              ["Notes", v.notes],
            ]}
          />
        </Panel>
        <div className="space-y-6">
          <Panel title={`Owned equipment (${v.equipment.length})`}>
            {v.equipment.length ? (
              <ul className="divide-y divide-line/50 text-sm">
                {v.equipment.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <Link href={`/admin/catalog/equipment/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                    <StatusPill status={e.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None.</p>
            )}
          </Panel>
          <Panel title="Linked requests">
            {v.supplyOrders.length + v.serviceRequests.length ? (
              <ul className="divide-y divide-line/50 text-sm">
                {v.supplyOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/admin/supply-orders/${o.id}`} className="font-mono hover:underline">
                      SO-{String(o.number).padStart(4, "0")}
                    </Link>
                    <span className="flex-1 truncate text-muted">{o.items}</span>
                    <StatusPill status={o.status} />
                  </li>
                ))}
                {v.serviceRequests.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/admin/service-requests/${o.id}`} className="font-mono hover:underline">
                      SR-{String(o.number).padStart(4, "0")}
                    </Link>
                    <span className="flex-1 truncate text-muted">{o.service.name}</span>
                    <StatusPill status={o.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
