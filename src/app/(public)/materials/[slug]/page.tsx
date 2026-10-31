import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { whatsappHref } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { seedOf } from "@/components/ui/smart-image";
import { ProductCard } from "@/components/public/cards";
import { Gallery } from "@/components/public/gallery";
import { RequestButton } from "@/components/public/request-sheet";
import { Container, Grid, Section, SectionHeading } from "@/components/public/section";
import { formatRwf, PRODUCT_UNIT_LABEL } from "@/server/modules/catalog/catalog.money";
import { getProductBySlug } from "@/server/modules/catalog/product/product.queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await getProductBySlug.page({ slug: (await params).slug });
  return { title: item.name, description: item.description.slice(0, 160) };
}

export default async function ProductDetailPage({ params }: Props) {
  const { item, related } = await getProductBySlug.page({ slug: (await params).slug });
  const unit = PRODUCT_UNIT_LABEL[item.unit] ?? item.unit.toLowerCase();
  return (
    <>
      <Container className="py-6">
        <Link href={`/materials?category=${item.category.slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> {item.category.name}
        </Link>
      </Container>
      <Container className="grid gap-10 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <Gallery images={item.images} alt={item.name} icon="BrickWall" seed={seedOf(item.slug)} />
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{item.category.name}</Badge>
              {item.brand && <Badge>{item.brand}</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{item.name}</h1>
          </div>
          <div className="rounded-2xl bg-mist p-4">
            <p className="text-xs font-semibold text-muted uppercase">Price</p>
            <p className="mt-1 text-xl font-bold">{item.price ? `${formatRwf(item.price)} / ${unit}` : "Price on request"}</p>
            <p className="text-sm text-muted">Sold per {unit}</p>
          </div>
          <p className="leading-relaxed whitespace-pre-line">{item.description}</p>
          <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl bg-white/90 p-2 shadow-lift backdrop-blur lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
            <RequestButton size="lg" className="flex-1" target={{ kind: "supply", productId: item.id, itemName: item.name }} testId="detail-request">
              {item.price ? "Request this product" : "Request a quote"}
            </RequestButton>
            <a href={whatsappHref(`Hello Marino, I'm interested in ${item.name}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("dark", "lg")} aria-label="WhatsApp">
              <MessageCircle className="h-5 w-5" />
            </a>
          </div>
        </div>
      </Container>
      {related.length > 0 && (
        <Section tone="mist">
          <SectionHeading title={`More ${item.category.name.toLowerCase()}`} href={`/materials?category=${item.category.slug}`} />
          <Grid>
            {related.map((r) => (
              <ProductCard key={r.id} item={r} />
            ))}
          </Grid>
        </Section>
      )}
    </>
  );
}
