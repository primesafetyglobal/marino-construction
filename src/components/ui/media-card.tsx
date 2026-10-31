// Media card (Design §7): 4:3 image, title, meta line, price in mono, status
// badge, featured star, overflow menu slot. Used by admin catalog grids and
// public featured scrollers.

import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { SmartImage, type PlaceholderIcon } from "./smart-image";

export function MediaCard({
  href,
  image,
  title,
  meta,
  price,
  priceUnit,
  status,
  featured,
  menu,
  icon = "ImageIcon",
  seed = 0,
  className,
  footer,
  attention,
}: {
  href: string;
  image?: string | null;
  title: string;
  meta?: ReactNode;
  price?: string | null;
  priceUnit?: string | null;
  status?: ReactNode;
  featured?: boolean;
  menu?: ReactNode;
  icon?: PlaceholderIcon;
  seed?: number;
  className?: string;
  footer?: ReactNode;
  attention?: boolean;
}) {
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-[border-color,box-shadow] duration-200 hover:border-ink/25 hover:shadow-soft", attention && "ring-2 ring-brand", className)}>
      <div className="relative">
        <SmartImage src={image} alt={title} icon={icon} seed={seed} className="aspect-[4/3] w-full" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" />
        {attention && <span className="hazard absolute inset-x-0 top-0 h-1.5" aria-hidden />}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">{status}</div>
        {featured && (
          <span className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-charcoal text-brand" title="Featured">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="sr-only">Featured</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold">
            <Link href={href} className="rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand">
              {title}
            </Link>
          </h3>
          {menu && <div className="relative z-10 -mt-1 -mr-2">{menu}</div>}
        </div>
        {meta && <p className="truncate text-xs text-muted">{meta}</p>}
        <div className="mt-auto pt-3">
          {price === undefined ? null : price ? (
            <p className="num text-[15px] font-semibold">
              {price}
              {priceUnit && <span className="text-xs font-normal text-muted"> / {priceUnit}</span>}
            </p>
          ) : (
            <p className="text-xs text-muted">Price on request</p>
          )}
        </div>
        {footer && <div className="relative z-10 pt-3">{footer}</div>}
      </div>
    </article>
  );
}
