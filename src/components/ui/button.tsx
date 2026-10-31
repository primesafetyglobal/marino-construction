import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  // Yellow buttons always carry charcoal text (Design §2): AA on #F5B301.
  primary: "bg-brand text-charcoal hover:bg-brand-hover border border-brand-hover/40",
  dark: "bg-charcoal text-white hover:bg-charcoal-soft border border-charcoal",
  outline: "border border-line-strong bg-white text-ink hover:bg-canvas hover:border-ink/30",
  ghost: "text-ink hover:bg-canvas",
  danger: "border border-danger/30 bg-white text-danger hover:bg-danger-tint",
  light: "bg-white/10 text-white hover:bg-white/20 border border-white/25",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-[var(--radius-input)] font-semibold whitespace-nowrap transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  external,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; external?: boolean }) {
  return <Link className={buttonClass(variant, size, className)} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props} />;
}
