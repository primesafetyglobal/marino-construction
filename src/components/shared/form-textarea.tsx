"use client";

import { cn } from "@/lib/utils";

interface FormTextareaProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  rows?: number;
  className?: string;
}

export function FormTextarea({
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  value,
  onChange,
  error,
  rows = 4,
  className,
}: FormTextareaProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={name}
        className="text-sm font-medium text-stone-700"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={rows}
        className={cn(
          "w-full rounded-xl border border-stone-300 bg-white/60 px-3.5 py-2.5 text-sm text-stone-900",
          "placeholder:text-stone-400",
          "focus:border-olive-600 focus:outline-none focus:ring-2 focus:ring-olive-600/20",
          "backdrop-blur-sm transition-all duration-200 resize-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20"
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
