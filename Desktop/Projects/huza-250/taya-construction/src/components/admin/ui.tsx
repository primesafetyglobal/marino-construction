import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Crumb = { href?: string; label: string };

/** Title, one-line description, breadcrumbs, primary action on the right, optional tabs. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  crumbs,
  tabs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  crumbs?: Crumb[];
  tabs?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {crumbs.map((c, i) => (
              <li key={i} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="rounded hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {back && !crumbs && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 rounded text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="yellow-rule mb-3" aria-hidden />
          <h1 className="text-[26px] leading-tight font-bold md:text-[30px]">{title}</h1>
          {subtitle && <div className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </header>
  );
}

/** Underline tabs for page sections (links keep the state in the URL). */
export function TabLinks({ tabs, current }: { tabs: { href: string; label: string; value: string; count?: number }[]; current: string }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-t-md px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-brand" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("num rounded-md px-1.5 text-[11px]", active ? "bg-charcoal text-white" : "bg-canvas text-muted")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Panel({ title, children, actions, className, flush, attention }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; flush?: boolean; attention?: boolean }) {
  return (
    <section className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-white", attention && "hazard-edge", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

export function DefList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[150px_1fr]">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label, big mono number, optional delta line and link. "danger" with a value adds the hazard stripe. */
export function StatCard({ label, value, href, tone, hint, icon }: { label: string; value: number | string; href?: string; tone?: "danger" | "brand"; hint?: ReactNode; icon?: ReactNode }) {
  const alert = tone === "danger" && Number(value) > 0;
  const inner = (
    <div className={cn("group relative h-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-white p-5 transition-[border-color,box-shadow] duration-150", href && "hover:border-ink/25 hover:shadow-soft", alert && "hazard-edge border-danger/30")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
        {href && !icon && <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </div>
      <p className={cn("num mt-3 text-[34px] leading-none font-semibold", alert && "text-danger", tone === "brand" && "text-ink")}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      {tone === "brand" && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" aria-hidden />}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Avatar initials for clients, vendors, applicants and users. */
export function Initials({ name, className }: { name: string; className?: string }) {
  const text =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-canvas font-display text-sm font-semibold text-ink [font-stretch:88%]", className)} aria-hidden>
      {text}
    </span>
  );
}

/** Client / vendor / applicant card: avatar initials, name, meta, badges. */
export function EntityCard({ name, meta, badges, href, children }: { name: string; meta?: ReactNode; badges?: ReactNode; href?: string; children?: ReactNode }) {
  const body = (
    <div className={cn("flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 transition-[border-color,box-shadow] duration-150", href && "hover:border-ink/25 hover:shadow-soft")}>
      <Initials name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {meta && <div className="mt-0.5 truncate text-xs text-muted">{meta}</div>}
        {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        {children}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}
