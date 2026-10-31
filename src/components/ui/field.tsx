"use client";
// Form kit (Design §7): Section, Field (label + hint + error), Input with
// prefix / suffix, Select, Textarea with counter, Switch, Checkbox, Segmented,
// FormFooter (sticky Cancel / Save, unsaved-changes warning). CLIENT-SAFE.

import { useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Full width unless the caller sets its own width (w-auto, w-32, …): cn() does not merge classes.
const width = (className?: string) => (/(^|\s)(max-)?w-/.test(className ?? "") ? null : "w-full");

const control =
  "rounded-[var(--radius-input)] border border-line-strong bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-ink/30 focus:border-charcoal focus:outline-none focus:ring-3 focus:ring-brand/35 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
  optional,
  required,
}: {
  label?: ReactNode;
  name?: string;
  error?: string[] | string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
  required?: boolean;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
      )}
      {children}
      {hint && !message && (
        <p id={name ? `${name}-hint` : undefined} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {message && (
        <p id={name ? `${name}-error` : undefined} className="text-xs font-medium text-danger" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** A titled group inside a long form (Basics, Pricing, Photos, Visibility). */
export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("grid gap-5 border-t border-line pt-6 first:border-t-0 first:pt-0 md:grid-cols-[220px_1fr] md:gap-8", className)}>
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="font-display text-[15px] font-semibold [font-stretch:88%]">{title}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </fieldset>
  );
}

export function Input({
  className,
  invalid,
  prefix,
  suffix,
  ...props
}: Omit<ComponentProps<"input">, "prefix"> & { invalid?: boolean; prefix?: ReactNode; suffix?: ReactNode }) {
  const id = props.id ?? props.name;
  const input = (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      className={cn(control, width(className), "h-11", invalid && "border-danger", prefix ? "pl-14" : null, suffix ? "pr-16" : null, (props.type === "number" || props.inputMode === "numeric") && "num", className)}
      {...props}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center border-r border-line text-xs font-semibold text-muted">{prefix}</span>}
      {input}
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-medium text-muted">{suffix}</span>}
    </div>
  );
}

export function Textarea({ className, invalid, showCount, ...props }: ComponentProps<"textarea"> & { invalid?: boolean; showCount?: boolean }) {
  const [length, setLength] = useState(String(props.value ?? props.defaultValue ?? "").length);
  const current = props.value !== undefined ? String(props.value).length : length;
  return (
    <div className="relative">
      <textarea
        id={props.id ?? props.name}
        aria-invalid={invalid || undefined}
        className={cn(control, "w-full min-h-28 py-2.5 leading-relaxed", invalid && "border-danger", showCount && "pb-6", className)}
        {...props}
        onChange={(e) => {
          setLength(e.target.value.length);
          props.onChange?.(e);
        }}
      />
      {showCount && props.maxLength && (
        <span className={cn("num pointer-events-none absolute right-3 bottom-2 text-[11px]", current > props.maxLength * 0.9 ? "text-warning" : "text-muted")} aria-live="polite">
          {current} / {props.maxLength}
        </span>
      )}
    </div>
  );
}

export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      id={props.id ?? props.name}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        width(className),
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236B6B66%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-9",
        invalid && "border-danger",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-charcoal" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** On / off switch. Works as a checkbox in forms (name + checked). */
export function Switch({ label, hint, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={props.id ?? id} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-6 w-10 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-charcoal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-50" />
        <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-4 peer-checked:bg-brand" />
      </span>
    </label>
  );
}

// Two-option toggle (Yes / No, Individual / Company, Rent / Buy).
export function Segmented<T extends string>({ value, onChange, options, name, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; name?: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("inline-flex rounded-[var(--radius-input)] border border-line bg-canvas p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const i = options.findIndex((x) => x.value === value);
            const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
            onChange(next.value);
          }}
          className={cn(
            "rounded-[9px] px-4 py-1.5 text-sm font-medium transition-colors duration-150",
            value === o.value ? "bg-white text-ink shadow-soft ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-[var(--radius-input)] border border-danger/25 bg-danger-tint px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

/** Warns before leaving the page while `dirty`. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);
}

/** Sticky Cancel / Save bar at the bottom of a long form. */
export function FormFooter({ dirty, pending, onCancel, saveLabel = "Save", cancelLabel = "Cancel", children }: { dirty?: boolean; pending?: boolean; onCancel?: () => void; saveLabel?: string; cancelLabel?: string; children?: ReactNode }) {
  useUnsavedWarning(!!dirty && !pending);
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:-mx-6 md:px-6">
      <p className="mr-auto text-xs text-muted" aria-live="polite">
        {dirty ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved changes
          </span>
        ) : (
          "All changes saved"
        )}
      </p>
      {children}
      {onCancel && (
        <button type="button" onClick={onCancel} className="inline-flex h-11 items-center rounded-[var(--radius-input)] border border-line-strong bg-white px-5 text-[15px] font-semibold hover:bg-canvas">
          {cancelLabel}
        </button>
      )}
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-[var(--radius-input)] border border-brand-hover/40 bg-brand px-5 text-[15px] font-semibold text-charcoal hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
