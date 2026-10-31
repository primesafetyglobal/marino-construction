import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 lg:px-6", className)}>{children}</div>;
}

export function Section({ children, className, tone = "white", id }: { children: ReactNode; className?: string; tone?: "white" | "mist" | "dark"; id?: string }) {
  return (
    <section id={id} className={cn("py-14 lg:py-20", tone === "mist" && "bg-canvas", tone === "dark" && "bg-charcoal text-white", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, href, linkLabel = "See all", dark }: { eyebrow?: string; title: string; intro?: ReactNode; href?: string; linkLabel?: string; dark?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className={cn("mb-3 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase", dark ? "text-brand" : "text-muted")}>
            <span className="h-[3px] w-6 rounded-full bg-brand" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h2 className="text-3xl leading-tight font-bold sm:text-[40px]">{title}</h2>
        {intro && <p className={cn("mt-3 text-[17px]", dark ? "text-white/70" : "text-muted")}>{intro}</p>}
      </div>
      {href && (
        <Link href={href} className={cn("inline-flex items-center gap-1 text-sm font-semibold hover:underline", dark ? "text-white" : "text-ink")}>
          {linkLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// Horizontal scroller for featured items on phones, a grid on desktop.
export function Scroller({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&>*]:w-[78%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">{children}</div>;
}

export function Grid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4")}>{children}</div>;
}

export function PageHero({ eyebrow, title, intro, children, dark = false }: { eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode; dark?: boolean }) {
  return (
    <section className={cn("relative overflow-hidden", dark ? "bg-earth-deep text-white" : "bg-gradient-to-br from-sand-deep via-sand to-white")}>
      <div className={cn("absolute inset-0 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]", dark ? "text-brand opacity-[0.08]" : "text-earth opacity-[0.07]")} />
      {!dark && <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />}
      <Container className="relative py-14 lg:py-20">
        {eyebrow && <p className={cn("mb-3 text-xs font-semibold tracking-[0.16em] uppercase", dark ? "text-brand" : "text-earth")}>{eyebrow}</p>}
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className={cn("mt-4 max-w-2xl text-lg", dark ? "text-white/75" : "text-muted")}>{intro}</p>}
        {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
      </Container>
    </section>
  );
}
