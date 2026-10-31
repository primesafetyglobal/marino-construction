import type { ReactNode } from "react";
import { Inbox, Lock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({ title, children, action, icon, className }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("blueprint flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white px-6 py-14 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-line bg-white text-ink shadow-soft">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-display text-base font-semibold [font-stretch:88%] text-ink">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry, className }: { message: string; retry?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-danger/20 bg-danger-tint/50 px-6 py-10 text-center", className)}>
      <TriangleAlert className="h-6 w-6 text-danger" />
      <p className="text-sm text-ink">{message}</p>
      {retry}
    </div>
  );
}

export function NoAccess() {
  return (
    <EmptyState icon={<Lock className="h-6 w-6" />} title="You don't have access to this page">
      Ask an administrator if you need it.
    </EmptyState>
  );
}
