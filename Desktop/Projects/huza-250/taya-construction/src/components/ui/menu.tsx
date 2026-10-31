"use client";
// Overflow menu (row and card actions). Keyboard: Enter / Space / ArrowDown
// opens, arrows move, Escape closes and returns focus, Tab leaves.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export type MenuItem = { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean } | "separator";

export function OverflowMenu({ items, label = "More actions", className, align = "right" }: { items: MenuItem[]; label?: string; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const visible = items.filter((i) => i === "separator" || !i.disabled);

  useEffect(() => {
    if (!open) return;
    const first = menu.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!visible.some((i) => i !== "separator")) return null;

  const move = (d: 1 | -1) => {
    const all = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + d + all.length) % all.length]?.focus();
  };

  return (
    <div className={cn("relative inline-block", className)} onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            }
            else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            }
            else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              button.current?.focus();
            } else if (e.key === "Tab") setOpen(false);
          }}
          className={cn("absolute z-40 mt-1 min-w-44 animate-fade-up rounded-[12px] border border-line bg-white p-1 shadow-lift", align === "right" ? "right-0" : "left-0")}
        >
          {visible.map((item, i) =>
            item === "separator" ? (
              <div key={i} role="separator" className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn("flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm outline-none hover:bg-canvas focus:bg-canvas", item.danger ? "text-danger" : "text-ink")}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
