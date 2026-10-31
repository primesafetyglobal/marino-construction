import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, MapPin, MessageCircle } from "lucide-react";
import { whatsappHref } from "@/config/site";
import { Badge, StatusPill } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { seedOf } from "@/components/ui/smart-image";
import { EquipmentCard } from "@/components/public/cards";
import { Gallery } from "@/components/public/gallery";
import { RequestButton } from "@/components/public/request-sheet";
import { Container, Grid, Section, SectionHeading } from "@/components/public/section";
import { formatRwf, formatRwfPer } from "@/server/modules/catalog/catalog.money";
import { getEquipmentBySlug } from "@/server/modules/catalog/equipment/equipment.queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await getEquipmentBySlug.page({ slug: (await params).slug });
  return { title: item.name, description: item.description.slice(0, 160) };
}

export default async function EquipmentDetailPage({ params }: Props) {
  const { item, related } = await getEquipmentBySlug.page({ slug: (await params).slug });
  const target = { kind: "equipment" as const, equipmentId: item.id, itemName: item.name, mode: item.forRent ? ("RENT" as const) : ("BUY" as const) };
  return (
    <>
      <Container className="py-6">
        <Link href={`/equipment?category=${item.category.slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> {item.category.name}
        </Link>
      </Container>
      <Container className="grid gap-10 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <Gallery images={item.images} alt={item.name} icon="Truck" seed={seedOf(item.slug)} />
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{item.category.name}</Badge>
              <StatusPill status={item.status} />
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{item.name}</h1>
            <p className="mt-2 flex items-center gap-1 text-muted">
              <MapPin className="h-4 w-4" /> {item.location}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {item.forRent && (
              <div className="rounded-2xl bg-mist p-4">
                <p className="text-xs font-semibold text-muted uppercase">For rent</p>
                <p className="mt-1 text-xl font-bold">{formatRwfPer(item.rentPrice, item.rentUnit)}</p>
              </div>
            )}
            {item.forSale && (
              <div className="rounded-2xl bg-mist p-4">
                <p className="text-xs font-semibold text-muted uppercase">For sale</p>
                <p className="mt-1 text-xl font-bold">{item.salePrice ? formatRwf(item.salePrice) : "Price on request"}</p>
              </div>
            )}
          </div>
          <p className="leading-relaxed whitespace-pre-line">{item.description}</p>
          {item.specs.length > 0 && (
            <table className="w-full overflow-hidden rounded-2xl text-sm">
              <tbody>
                {item.specs.map((s) => (
                  <tr key={s.label} className="border-b border-line/50 last:border-0">
                    <th className="w-2/5 bg-mist px-4 py-2.5 text-left font-medium text-muted">{s.label}</th>
                    <td className="px-4 py-2.5">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl bg-white/90 p-2 shadow-lift backdrop-blur lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
            <RequestButton size="lg" className="flex-1" target={target} testId="detail-request">
              {item.status === "RENTED" ? "Request (currently rented)" : "Request this equipment"}
            </RequestButton>
            <a href={whatsappHref(`Hello Marino, I'm interested in ${item.name}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("dark", "lg")} aria-label="WhatsApp">
              <MessageCircle className="h-5 w-5" />
            </a>
          </div>
        </div>
      </Container>
      {related.length > 0 && (
        <Section tone="mist">
          <SectionHeading title={`More ${item.category.name.toLowerCase()}`} href={`/equipment?category=${item.category.slug}`} />
          <Grid>
            {related.map((r) => (
              <EquipmentCard key={r.id} item={r} />
            ))}
          </Grid>
        </Section>
      )}
    </>
  );
}
