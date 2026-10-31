import Link from "next/link";
import { ActionButton } from "@/components/admin/actions";
import { ServiceForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { deleteService } from "@/server/modules/catalog/service/service.actions";
import { getServiceAdmin } from "@/server/modules/catalog/service/service.queries";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export default async function ServiceAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories, user] = await Promise.all([getServiceAdmin.page({ id }), getCategoriesByType.page({ type: "SERVICE" }), requireUser()]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/services", label: "Services" }}
        title={item.name}
        subtitle={
          <span>
            {item.category.name} · {item._count.requests} request{item._count.requests === 1 ? "" : "s"} ·{" "}
            <Link href={`/services/${item.slug}`} target="_blank" className="underline">
              public page
            </Link>
          </span>
        }
        actions={
          hasPermission(user, "service:delete") && item._count.requests === 0 ? (
            <ActionButton variant="danger" confirm="Delete this service?" action={deleteService.bind(null, { id: item.id })} redirectTo="/admin/catalog/services" success="Deleted.">
              Delete
            </ActionButton>
          ) : null
        }
      />
      <Panel className="max-w-3xl">
        {hasPermission(user, "service:update") ? <ServiceForm item={item} categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} /> : <p className="text-sm text-muted">Read only.</p>}
      </Panel>
    </>
  );
}
