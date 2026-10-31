import { EquipmentForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export default async function NewEquipmentPage() {
  const categories = await getCategoriesByType.page({ type: "EQUIPMENT" });
  return (
    <>
      <PageHeader back={{ href: "/admin/catalog/equipment", label: "Equipment" }} title="New equipment" subtitle="Staff-created equipment is available straight away." />
      <Panel className="max-w-3xl">
        <EquipmentForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />
      </Panel>
    </>
  );
}
