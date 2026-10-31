import { divisionByEnum } from "@/config/divisions";
import { ActionButton } from "@/components/admin/actions";
import { CategoryDialogButton } from "@/components/admin/catalog-forms";
import { PageHeader } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/states";
import { humanize } from "@/lib/format";
import { hasPermission, requireUser } from "@/server/validation/auth";
import { deleteCategory } from "@/server/modules/catalog/category/category.actions";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { listCategories } from "@/server/modules/catalog/category/category.queries";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [list, user, uploads] = await Promise.all([listCategories.page({}), requireUser(), hasActiveStorage("PUBLIC")]);
  const items = list.view === "admin" ? list.items : [];
  const groups = ["EQUIPMENT", "PRODUCT", "SERVICE"] as const;
  return (
    <>
      <PageHeader title="Categories" actions={hasPermission(user, "category:create") ? <CategoryDialogButton label="New category" uploadsEnabled={uploads} /> : null} />
      {!items.length && <EmptyState title="No categories yet" />}
      <div className="space-y-6">
        {groups.map((g) => {
          const rows = items.filter((c) => c.type === g);
          if (!rows.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{humanize(g)}</h2>
              <ul className="divide-y divide-line/50 rounded-[var(--radius-card)] border border-line/50 bg-white shadow-soft">
                {rows.map((c) => {
                  const used = c._count.equipment + c._count.products + c._count.services;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="w-10 text-xs text-muted">#{c.order}</span>
                      <span className="flex-1 font-medium">{c.name}</span>
                      <span className="text-sm text-muted">{divisionByEnum(c.division)?.shortName}</span>
                      <span className="w-20 text-sm text-muted">{used} item{used === 1 ? "" : "s"}</span>
                      {hasPermission(user, "category:update") && <CategoryDialogButton label="Edit" item={c} uploadsEnabled={uploads} />}
                      {hasPermission(user, "category:delete") && used === 0 && (
                        <ActionButton variant="danger" confirm="Delete this category?" action={deleteCategory.bind(null, { id: c.id })} success="Deleted.">
                          Delete
                        </ActionButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
