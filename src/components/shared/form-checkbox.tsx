"use client";

import { cn } from "@/lib/utils";

interface FormCheckboxProps {
  name: string;
  label: string | React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function FormCheckbox({
  name,
  label,
  checked,
  onChange,
  disabled = false,
  className,
}: FormCheckboxProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className={cn(
          "size-4 rounded border-stone-300 text-olive-600",
          "focus:ring-olive-600/20 focus:ring-2 focus:ring-offset-0",
          "accent-olive-600"
        )}
      />
      <label htmlFor={name} className="text-sm text-stone-600 select-none">
        {label}
      </label>
    </div>
  );
}
