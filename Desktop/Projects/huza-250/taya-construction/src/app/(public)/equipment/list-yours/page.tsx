import type { Metadata } from "next";
import { Container, PageHero } from "@/components/public/section";
import { ListEquipmentForm } from "@/components/public/vendor-forms";
import { hasActiveStorage } from "@/server/modules/filing/lib";
import { getCategoriesByType } from "@/server/modules/catalog/category/category.queries";

export const metadata: Metadata = { title: "Rent out or sell your equipment", description: "Turn your idle equipment into an opportunity with Marino." };

export default async function ListYoursPage() {
  const categories = await getCategoriesByType.page({ type: "EQUIPMENT" });
  return (
    <>
      <PageHero
        eyebrow="Equipment · Trade"
        title="Rent out or sell your equipment"
        intro="Have equipment or machinery that you are not using? Turn your idle equipment into an opportunity. We connect owners with contractors, construction companies and other customers."
      />
      <Container className="max-w-3xl py-12">
        <div className="rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft lg:p-10">
          <ListEquipmentForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} uploadsEnabled={(await hasActiveStorage("PUBLIC"))} />
        </div>
        <p className="mt-4 text-center text-sm text-muted">New listings are reviewed by our team before they appear on the website. Your contact details are never shown publicly.</p>
      </Container>
    </>
  );
}
