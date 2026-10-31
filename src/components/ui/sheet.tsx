"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Escape closes, Tab stays inside, focus goes in on open and back on close, page does not scroll.
function useModal(open: boolean, onClose: () => void, panel: RefObject<HTMLDivElement | null>, opts: { lockScroll?: boolean; focusFirstField?: boolean } = {}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    if (opts.lockScroll !== false) document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const root = panel.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = (opts.focusFirstField ? root.querySelector<HTMLElement>("input, select, textarea") : null) ?? root.querySelector<HTMLElement>("[data-autofocus]") ?? root.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 30);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      before?.focus?.();
    };
  }, [open, panel, opts.lockScroll, opts.focusFirstField]);
}

// A sheet over the page: right side on desktop, bottom on mobile (Design §4).
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, onClose, panel, { focusFirstField: true });

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 animate-fade bg-charcoal/45" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute flex flex-col bg-white shadow-lift",
          "inset-x-0 bottom-0 max-h-[92dvh] animate-sheet-up rounded-t-[var(--radius-sheet)]",
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-full md:animate-sheet-right md:rounded-none md:rounded-l-[var(--radius-sheet)]",
          wide ? "md:max-w-2xl" : "md:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div id={titleId} className="min-w-0 font-display text-lg font-semibold [font-stretch:88%]">
            {title}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-[10px] p-2 text-muted transition-colors hover:bg-canvas hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-line bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// A centred dialog (admin confirmations and small forms).
export function Dialog({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" | "xl" }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, onClose, panel, { lockScroll: true });
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 animate-fade bg-charcoal/45" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-fade-up flex-col rounded-t-[var(--radius-sheet)] bg-white shadow-lift sm:rounded-[var(--radius-sheet)]",
          size === "md" ? "max-w-lg" : size === "lg" ? "max-w-2xl" : "max-w-4xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-[10px] p-2 text-muted hover:bg-canvas hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirm a destructive or irreversible step. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  tone = "danger",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-[var(--radius-input)] border border-line-strong bg-white px-4 text-sm font-semibold hover:bg-canvas">
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              "inline-flex h-10 items-center rounded-[var(--radius-input)] px-4 text-sm font-semibold disabled:opacity-60",
              tone === "danger" ? "bg-danger text-white hover:bg-danger/90" : "border border-brand-hover/40 bg-brand text-charcoal hover:bg-brand-hover",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3 text-sm text-muted">
        {tone === "danger" && <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />}
        <div>{children}</div>
      </div>
    </Dialog>
  );
}
