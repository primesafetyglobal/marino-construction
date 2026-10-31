import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "dark";

const TONE: Record<Tone, string> = {
  neutral: "bg-canvas text-muted ring-line",
  brand: "bg-brand-tint text-charcoal ring-brand/50",
  success: "bg-success-tint text-success ring-success/20",
  warning: "bg-warning-tint text-warning ring-warning/25",
  danger: "bg-danger-tint text-danger ring-danger/20",
  info: "bg-info-tint text-info ring-info/20",
  dark: "bg-charcoal text-white ring-charcoal",
};

const DOT: Record<Tone, string> = { neutral: "bg-muted", brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", dark: "bg-brand" };

export function Badge({ tone = "neutral", children, className, icon, dot }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", TONE[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}

// One colour per status family (Design §7): new (info), waiting (warning),
// in progress (brand), done (success), cancelled (neutral), overdue (danger).
export const STATUS_FAMILY: Record<string, Tone> = {
  NEW: "info",
  PENDING: "warning",
  QUOTED: "brand",
  CONFIRMED: "brand",
  SCHEDULED: "brand",
  IN_PROGRESS: "brand",
  RECRUITING: "brand",
  ACTIVE: "brand",
  SHORTLISTED: "brand",
  RENTED: "brand",
  DUE: "warning",
  COMPLETED: "success",
  DELIVERED: "success",
  FILLED: "success",
  PLACED: "success",
  PAID: "success",
  APPROVED: "success",
  AVAILABLE: "success",
  PUBLIC: "success",
  CANCELLED: "neutral",
  CLOSED: "neutral",
  REJECTED: "neutral",
  INACTIVE: "neutral",
  SOLD: "neutral",
  PRIVATE: "neutral",
  OVERDUE: "danger",
};

const LABEL: Record<string, string> = { IN_PROGRESS: "In progress" };

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const label = LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge tone={STATUS_FAMILY[status] ?? "neutral"} dot className={className}>
      {label}
    </Badge>
  );
}
