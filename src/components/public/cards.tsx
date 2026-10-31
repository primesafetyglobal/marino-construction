import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Briefcase, CalendarDays, MapPin, Quote, Users } from "lucide-react";
import type { Division } from "@/config/divisions";
import { divisionByEnum } from "@/config/divisions";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DivisionIcon } from "@/components/ui/icons";
import { SmartImage, seedOf } from "@/components/ui/smart-image";
import { Stars } from "@/components/ui/stars";
import { formatDate } from "@/lib/format";
import { formatRwf, formatRwfPer, PRODUCT_UNIT_LABEL } from "@/server/modules/catalog/catalog.money";
import type { EquipmentPublic } from "@/server/modules/catalog/equipment/equipment.select";
import type { ProductPublic } from "@/server/modules/catalog/product/product.select";
import type { ServicePublic } from "@/server/modules/catalog/service/service.select";
import type { TrainingPublic } from "@/server/modules/catalog/training/training.select";
import type { JobPost } from "@/server/modules/operations/workforce-request/workforce-request.select";
import { RequestButton } from "./request-sheet";

const card = "group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-[border-color,box-shadow] duration-200 hover:border-ink/25 hover:shadow-soft";

export function EquipmentCard({ item }: { item: EquipmentPublic }) {
  const price = item.forRent ? formatRwfPer(item.rentPrice, item.rentUnit) : item.forSale ? formatRwf(item.salePrice) : "Price on request";
  return (
    <article className={card} data-testid="equipment-card">
      <Link href={`/equipment/${item.slug}`} className="relative">
        <SmartImage src={item.images[0]} alt={item.name} icon="Truck" seed={seedOf(item.slug)} className="aspect-[4/3]" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge tone="brand" className="shadow-sm" icon={<BadgeCheck className="h-3 w-3" />}>
            Verified
          </Badge>
          {item.status === "RENTED" && <Badge tone="warning">Rented</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-muted">{item.category.name}</p>
        <Link href={`/equipment/${item.slug}`} className="text-[17px] leading-snug font-semibold hover:underline">
          {item.name}
        </Link>
        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5" /> {item.location}
        </p>
        <p className="num mt-auto pt-1 font-semibold">{price}</p>
        <div className="flex gap-2 pt-2">
          <Link href={`/equipment/${item.slug}`} className={buttonClass("outline", "sm", "flex-1")}>
            View
          </Link>
          <RequestButton size="sm" className="flex-1" target={{ kind: "equipment", equipmentId: item.id, itemName: item.name, mode: item.forRent ? "RENT" : "BUY" }} testId="card-request">
            Request
          </RequestButton>
        </div>
      </div>
    </article>
  );
}

export function ProductCard({ item }: { item: ProductPublic }) {
  const price = item.price ? `${formatRwf(item.price)} / ${PRODUCT_UNIT_LABEL[item.unit] ?? item.unit.toLowerCase()}` : "Request a quote";
  return (
    <article className={card} data-testid="product-card">
      <Link href={`/materials/${item.slug}`}>
        <SmartImage src={item.images[0]} alt={item.name} icon="BrickWall" seed={seedOf(item.slug)} className="aspect-[4/3]" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-muted">
          {item.category.name}
          {item.brand ? ` · ${item.brand}` : ""}
        </p>
        <Link href={`/materials/${item.slug}`} className="text-[17px] leading-snug font-semibold hover:underline">
          {item.name}
        </Link>
        <p className="num mt-auto pt-1 font-semibold">{price}</p>
        <div className="flex gap-2 pt-2">
          <Link href={`/materials/${item.slug}`} className={buttonClass("outline", "sm", "flex-1")}>
            View
          </Link>
          <RequestButton size="sm" className="flex-1" target={{ kind: "supply", productId: item.id, itemName: item.name }}>
            Request
          </RequestButton>
        </div>
      </div>
    </article>
  );
}

export function ServiceCard({ item }: { item: ServicePublic }) {
  const division = divisionByEnum(item.category.division);
  return (
    <article className={card} data-testid="service-card">
      <Link href={`/services/${item.slug}`}>
        <SmartImage src={item.image} alt={item.name} icon={division?.icon ?? "Wrench"} seed={seedOf(item.slug)} className="aspect-[16/9]" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <Link href={`/services/${item.slug}`} className="text-[17px] leading-snug font-semibold hover:underline">
          {item.name}
        </Link>
        <p className="text-sm text-muted">{item.summary}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <Link href={`/services/${item.slug}`} className={buttonClass("outline", "sm", "flex-1")}>
            Learn more
          </Link>
          <RequestButton
            size="sm"
            className="flex-1"
            target={{ kind: "service", serviceId: item.id, itemName: item.name, division: item.category.division, installments: item.category.division === "PAINT_RWANDA" }}
            testId="service-request"
          >
            Request
          </RequestButton>
        </div>
      </div>
    </article>
  );
}

export function TrainingCard({ item }: { item: TrainingPublic }) {
  return (
    <article className={card} data-testid="training-card">
      <SmartImage src={item.image} alt={item.title} icon="GraduationCap" seed={seedOf(item.slug)} className="aspect-[16/9]" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <Badge tone="brand">{item.type === "HSE" ? "HSE" : "Construction"}</Badge>
          {item.duration && <span className="text-xs text-muted">{item.duration}</span>}
        </div>
        <h3 className="text-[17px] leading-snug font-semibold">{item.title}</h3>
        <p className="text-sm text-muted">{item.summary}</p>
        <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm", "mt-auto")}>
          View on Prime Safety Global <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

export function DivisionCard({ division }: { division: Division }) {
  return (
    <article className={card}>
      <Link href={`/${division.slug}`} className="relative">
        <SmartImage alt={division.name} icon={division.icon} seed={division.number} className="aspect-[16/10]" />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold">{String(division.number).padStart(2, "0")}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint">
            <DivisionIcon icon={division.icon} className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold">{division.name}</h3>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {division.subServices.slice(0, 5).map((s) => (
            <li key={s} className="rounded-full bg-mist px-2.5 py-1 text-xs text-ink">
              {s}
            </li>
          ))}
        </ul>
        <Link href={`/${division.slug}`} className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold hover:underline">
          Learn more <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export function ReviewCard({ review }: { review: { fullName: string; company: string | null; division: string | null; rating: number; message: string; createdAt: string | Date } }) {
  return (
    <figure className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line/50 bg-white p-6 shadow-soft">
      <Quote className="h-6 w-6 text-brand" />
      <Stars value={review.rating} />
      <blockquote className="flex-1 text-[15px] leading-relaxed">{review.message}</blockquote>
      <figcaption className="text-sm">
        <span className="font-semibold">{review.fullName}</span>
        {review.company && <span className="text-muted"> · {review.company}</span>}
        <span className="block text-xs text-muted">
          {review.division ? `${divisionByEnum(review.division)?.name} · ` : ""}
          {formatDate(review.createdAt)}
        </span>
      </figcaption>
    </figure>
  );
}

export function JobCard({ job }: { job: JobPost }) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line/50 bg-white p-5 shadow-soft sm:flex-row sm:items-center" data-testid="job-card">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
        <Briefcase className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/jobs/${job.number}`} className="text-lg font-semibold hover:underline">
          {job.role}
        </Link>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {job.quantity} needed
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {job.district}
          </span>
          <span>{job.duration}</span>
          {job.startDate && <span>Starts {formatDate(job.startDate)}</span>}
          {job.deadline && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Apply by {formatDate(job.deadline)}
            </span>
          )}
        </p>
      </div>
      <Link href={`/jobs/${job.number}`} className={buttonClass("primary", "sm")}>
        View &amp; apply
      </Link>
    </article>
  );
}
