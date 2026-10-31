import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { EquipmentCard, ProductCard, ServiceCard, TrainingCard } from "@/components/public/cards";
import { RequestButton } from "@/components/public/request-sheet";
import { SearchBox } from "@/components/public/search-box";
import { Container, Grid, Section } from "@/components/public/section";
import { listEquipment } from "@/server/modules/catalog/equipment/equipment.queries";
import { listProducts } from "@/server/modules/catalog/product/product.queries";
import { listServices } from "@/server/modules/catalog/service/service.queries";
import { listTrainings } from "@/server/modules/catalog/training/training.queries";
import type { EquipmentPublic } from "@/server/modules/catalog/equipment/equipment.select";
import type { ProductPublic } from "@/server/modules/catalog/product/product.select";
import type { ServicePublic } from "@/server/modules/catalog/service/service.select";
import type { TrainingPublic } from "@/server/modules/catalog/training/training.select";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const query = { q, limit: 6, view: "public" as const };
  const [equipment, products, services, trainings] = q
    ? await Promise.all([listEquipment.page(query), listProducts.page(query), listServices.page(query), listTrainings.page(query)])
    : [null, null, null, null];
  const total = (equipment?.items.length ?? 0) + (products?.items.length ?? 0) + (services?.items.length ?? 0) + (trainings?.items.length ?? 0);
  return (
    <>
      <section className="bg-mist">
        <Container className="py-10">
          <h1 className="text-3xl font-bold tracking-tight">{q ? `Results for “${q}”` : "Search"}</h1>
          <SearchBox className="mt-5 max-w-xl" />
        </Container>
      </section>
      {q && total === 0 && (
        <Section>
          <EmptyState title="No results" action={<RequestButton>Request a quote</RequestButton>}>
            Tell us what you need and we will find it.
          </EmptyState>
        </Section>
      )}
      {equipment && equipment.items.length > 0 && (
        <Group title="Equipment" href={`/equipment`}>
          {(equipment.items as EquipmentPublic[]).map((i) => (
            <EquipmentCard key={i.id} item={i} />
          ))}
        </Group>
      )}
      {products && products.items.length > 0 && (
        <Group title="Materials" href="/materials">
          {(products.items as ProductPublic[]).map((i) => (
            <ProductCard key={i.id} item={i} />
          ))}
        </Group>
      )}
      {services && services.items.length > 0 && (
        <Group title="Services" href="/inspection-testing">
          {(services.items as ServicePublic[]).map((i) => (
            <ServiceCard key={i.id} item={i} />
          ))}
        </Group>
      )}
      {trainings && trainings.items.length > 0 && (
        <Group title="Trainings" href="/training">
          {(trainings.items as TrainingPublic[]).map((i) => (
            <TrainingCard key={i.id} item={i} />
          ))}
        </Group>
      )}
    </>
  );
}

function Group({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Section className="py-10 lg:py-12">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-semibold hover:underline">
          See all
        </Link>
      </div>
      <Grid cols={3}>{children}</Grid>
    </Section>
  );
}
