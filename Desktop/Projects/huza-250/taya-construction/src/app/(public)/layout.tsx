import { Footer } from "@/components/public/footer";
import { Header, type MenuData } from "@/components/public/header";
import { MobileBar } from "@/components/public/mobile-bar";
import { RequestSheetProvider, type ServiceOption } from "@/components/public/request-sheet";
import { listCategories } from "@/server/modules/catalog/category/category.queries";
import { listServices } from "@/server/modules/catalog/service/service.queries";

// Public layout: utility bar, sticky header with the 8 divisions and the
// mega-menu, footer, mobile bottom bar, and the request sheet (Design §4).
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [categories, services] = await Promise.all([
    listCategories.page({}).catch(() => ({ view: "public" as const, items: [] })),
    listServices.page({ limit: 100, view: "public" }).catch(() => ({ view: "public" as const, items: [], nextCursor: null })),
  ]);
  // Signed-in staff get the admin select; the public site still shows active services only.
  const active = services.items.filter((s) => !("isActive" in s) || s.isActive);
  const menu: MenuData = {
    categories: categories.items.map((c) => ({ name: c.name, slug: c.slug, type: c.type, division: c.division })),
    services: active.map((s) => ({ name: s.name, slug: s.slug, division: s.category.division })),
  };
  const options: ServiceOption[] = active.map((s) => ({ id: s.id, name: s.name, division: s.category.division }));

  return (
    <RequestSheetProvider services={options}>
      <Header menu={menu} />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileBar />
    </RequestSheetProvider>
  );
}
