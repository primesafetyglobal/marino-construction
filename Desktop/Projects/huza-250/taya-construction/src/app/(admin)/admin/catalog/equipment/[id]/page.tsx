import Link from "next/link";
import { ActionButton } from "@/components/admin/actions";
import { EquipmentForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { approveEquipment, deleteEquipment, setEquipmentStatus } from "@/server/modules/catalog/equipment/equipment.actions";
import { getEquipmentAdmin } from "@/server/modules/catalog/equipment/equipment.queries";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";
import { getEquipmentRentHistory } from "@/server/modules/operations/equipment-request/equipment-request.queries";

export default async function EquipmentAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories, user, history] = await Promise.all([getEquipmentAdmin.page({ id }), getCategoriesByType.page({ type: "EQUIPMENT" }), requireUser(), getEquipmentRentHistory.page({ equipmentId: id })]);
  const canUpdate = hasPermission(user, "equipment:update");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/equipment", label: "Equipment" }}
        title={
          <span className="flex items-center gap-3">
            {item.name} <StatusPill status={item.status} />
          </span>
        }
        subtitle={item.owner ? `Owner: ${item.owner.companyName ?? item.owner.name} (${item.owner.status.toLowerCase()})` : "Marino-owned"}
        actions={
          <>
            {item.status === "PENDING" && hasPermission(user, "equipment:approve") && (
              <ActionButton variant="primary" action={approveEquipment.bind(null, { id: item.id })} success="Approved and published." testId="equipment-approve">
                Approve &amp; publish
              </ActionButton>
            )}
            {canUpdate && item.status !== "PENDING" && item.status !== "RENTED" && item.status !== "AVAILABLE" && (
              <ActionButton action={setEquipmentStatus.bind(null, { id: item.id, status: "AVAILABLE" })} success="Available again.">
                Make available
              </ActionButton>
            )}
            {canUpdate && item.status === "AVAILABLE" && (
              <>
                <ActionButton action={setEquipmentStatus.bind(null, { id: item.id, status: "SOLD" })} confirm="Mark as sold? It will be hidden from the website." success="Marked as sold.">
                  Mark sold
                </ActionButton>
                <ActionButton action={setEquipmentStatus.bind(null, { id: item.id, status: "INACTIVE" })} success="Set to inactive.">
                  Set inactive
                </ActionButton>
              </>
            )}
            {(item.status === "AVAILABLE" || item.status === "RENTED") && (
              <Link href={`/equipment/${item.slug}`} target="_blank" className="self-center text-sm underline">
                View public page
              </Link>
            )}
            {hasPermission(user, "equipment:delete") && item._count.requests === 0 && (
              <ActionButton variant="danger" confirm="Delete this equipment?" action={deleteEquipment.bind(null, { id: item.id })} redirectTo="/admin/catalog/equipment" success="Deleted.">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel>
          {canUpdate ? <EquipmentForm item={item} categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} /> : <p className="text-sm text-muted">You can view this item but not edit it.</p>}
        </Panel>
        <Panel title="Rent history">
          {history.length ? (
            <ul className="divide-y divide-line/50 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/equipment-requests/${h.id}`} className="font-mono hover:underline">
                    {h.code}
                  </Link>
                  <span className="text-xs text-muted">
                    {formatDate(h.startDate)} → {formatDate(h.endDate)}
                  </span>
                  <StatusPill status={h.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No rentals yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
