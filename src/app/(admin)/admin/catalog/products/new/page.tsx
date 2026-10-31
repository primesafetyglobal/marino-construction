import { ProductForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export default async function NewProductPage() {
  const categories = await getCategoriesByType.page({ type: "PRODUCT" });
  return (
    <>
      <PageHeader back={{ href: "/admin/catalog/products", label: "Products" }} title="New product" />
      <Panel className="max-w-3xl">
        <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />
      </Panel>
    </>
  );
}
