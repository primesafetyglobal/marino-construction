import { ServiceForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export default async function NewServicePage() {
  const categories = await getCategoriesByType.page({ type: "SERVICE" });
  return (
    <>
      <PageHeader back={{ href: "/admin/catalog/services", label: "Services" }} title="New service" />
      <Panel className="max-w-3xl">
        <ServiceForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />
      </Panel>
    </>
  );
}
