import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronLeft, CheckCircle2, MessageCircle } from "lucide-react";
import { divisionByEnum } from "@/config/divisions";
import { whatsappHref } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { SmartImage, seedOf } from "@/components/ui/smart-image";
import { ServiceCard } from "@/components/public/cards";
import { RequestButton } from "@/components/public/request-sheet";
import { Container, Grid, Section, SectionHeading } from "@/components/public/section";
import { getServiceBySlug } from "@/server/modules/catalog/service/service.queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await getServiceBySlug.page({ slug: (await params).slug });
  return { title: item.name, description: item.summary };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { item, others } = await getServiceBySlug.page({ slug: (await params).slug });
  const division = divisionByEnum(item.category.division);
  const target = { kind: "service" as const, serviceId: item.id, itemName: item.name, division: item.category.division, installments: item.category.division === "PAINT_RWANDA" };
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-sand-deep via-sand to-white">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
        <Container className="relative grid gap-8 py-12 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:py-16">
          <div>
            {division && (
              <Link href={`/${division.slug}`} className="inline-flex items-center gap-1 text-sm text-earth hover:text-ink">
                <ChevronLeft className="h-4 w-4" /> {division.name}
              </Link>
            )}
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{item.name}</h1>
            <p className="mt-4 text-lg text-muted">{item.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <RequestButton size="lg" target={target} testId="detail-request">
                Request this service
              </RequestButton>
              <a href={whatsappHref(`Hello Marino, about ${item.name}`)} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "lg")}>
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </a>
            </div>
          </div>
          <SmartImage src={item.image} alt={item.name} icon={division?.icon ?? "Wrench"} seed={seedOf(item.slug)} className="aspect-[4/3] rounded-[var(--radius-card)]" />
        </Container>
      </section>

      <Container className="grid gap-10 py-14 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          {item.content.map((section, i) => (
            <section key={i} className="animate-fade-up">
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              {section.type === "text" && <p className="mt-3 leading-relaxed whitespace-pre-line text-ink/90">{section.body}</p>}
              {section.type === "list" && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {section.items.map((it) => (
                    <li key={it} className="flex gap-2 rounded-xl bg-mist px-4 py-3 text-[15px]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {it}
                    </li>
                  ))}
                </ul>
              )}
              {section.type === "steps" && (
                <ol className="mt-4 space-y-3">
                  {section.items.map((it, n) => (
                    <li key={it} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-charcoal">{n + 1}</span>
                      <span className="pt-1">{it}</span>
                    </li>
                  ))}
                </ol>
              )}
              {section.type === "faq" && (
                <div className="mt-4 divide-y divide-line/60 rounded-2xl border border-line/60">
                  {section.items.map((f) => (
                    <details key={f.q} className="group px-5 py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                        {f.q}
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 text-muted">{f.a}</p>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-line/60 bg-white p-6 shadow-soft">
            {division && <Badge tone="brand">{division.name}</Badge>}
            <p className="mt-3 font-semibold">{item.name}</p>
            <p className="mt-1 text-sm text-muted">{item.summary}</p>
            <RequestButton className="mt-5 w-full" target={target}>
              Request this service
            </RequestButton>
          </div>
        </aside>
      </Container>

      {others.length > 0 && (
        <Section tone="mist">
          <SectionHeading title={`Other ${division?.name ?? ""} services`} href={division ? `/${division.slug}` : undefined} />
          <Grid cols={3}>
            {others.slice(0, 6).map((s) => (
              <ServiceCard key={s.id} item={s} />
            ))}
          </Grid>
        </Section>
      )}
    </>
  );
}
