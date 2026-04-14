"use client";

import { CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SigningStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function SigningSteps({ steps, currentStep, className }: SigningStepsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {steps.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-1">
            {idx > 0 && (
              <div
                className={cn(
                  "h-px w-4 sm:w-6 transition-colors",
                  isComplete ? "bg-olive-500" : "bg-stone-200"
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                isComplete && "bg-olive-100 text-olive-700",
                isCurrent && "bg-olive-600 text-white shadow-sm",
                !isComplete && !isCurrent && "bg-stone-100 text-stone-400"
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <step.icon className="size-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
