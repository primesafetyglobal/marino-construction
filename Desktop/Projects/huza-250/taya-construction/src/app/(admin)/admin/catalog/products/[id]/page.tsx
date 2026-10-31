import { ActionButton } from "@/components/admin/actions";
import { ProductForm } from "@/components/admin/catalog-forms";
import { PageHeader, Panel } from "@/components/admin/ui";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { deleteProduct } from "@/server/modules/catalog/product/product.actions";
import { getProductAdmin } from "@/server/modules/catalog/product/product.queries";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export default async function ProductAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories, user] = await Promise.all([getProductAdmin.page({ id }), getCategoriesByType.page({ type: "PRODUCT" }), requireUser()]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/products", label: "Products" }}
        title={item.name}
        subtitle={`${item.category.name} · ${item._count.orders} order${item._count.orders === 1 ? "" : "s"}`}
        actions={
          hasPermission(user, "product:delete") ? (
            <ActionButton variant="danger" confirm="Delete this product? Orders keep their text." action={deleteProduct.bind(null, { id: item.id })} redirectTo="/admin/catalog/products" success="Deleted.">
              Delete
            </ActionButton>
          ) : null
        }
      />
      <Panel className="max-w-3xl">
        {hasPermission(user, "product:update") ? <ProductForm item={item} categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} /> : <p className="text-sm text-muted">Read only.</p>}
      </Panel>
    </>
  );
}
