"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} className={i <= Math.round(value) ? "fill-brand text-brand" : "text-line"} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, name = "rating" }: { value: number; onChange: (v: number) => void; name?: string }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} name={name} onClick={() => onChange(i)} className="rounded-md p-0.5 transition-transform hover:scale-110">
          <Star className={cn("h-7 w-7", i <= value ? "fill-brand text-brand" : "text-line")} />
        </button>
      ))}
    </div>
  );
}
