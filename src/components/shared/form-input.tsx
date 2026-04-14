"use client";

import { cn } from "@/lib/utils";
import type { IFormFieldProps } from "@/types";

interface FormInputProps extends IFormFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

export function FormInput({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  value,
  onChange,
  error,
  className,
}: FormInputProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={name}
        className="text-sm font-medium text-stone-700"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "h-10 w-full rounded-xl border border-stone-300 bg-white/60 px-3.5 text-sm text-stone-900",
          "placeholder:text-stone-400",
          "focus:border-olive-600 focus:outline-none focus:ring-2 focus:ring-olive-600/20",
          "backdrop-blur-sm transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20"
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
