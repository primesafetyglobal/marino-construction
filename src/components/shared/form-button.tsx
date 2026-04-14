"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { IFormButtonProps } from "@/types";
import { EButtonSize } from "@/types";

const sizeMap: Record<EButtonSize, "sm" | "default" | "lg"> = {
  [EButtonSize.Small]: "sm",
  [EButtonSize.Medium]: "default",
  [EButtonSize.Large]: "lg",
};

export function FormButton({
  showText = true,
  showIcon = true,
  size = EButtonSize.Medium,
  label,
  icon: Icon,
  type = "button",
  variant = "default",
  isLoading = false,
  disabled = false,
  onClick,
  className,
}: IFormButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      size={sizeMap[size]}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn("gap-2 font-medium", className)}
    >
      {isLoading && <Loader2 className="size-4 animate-spin" />}
      {!isLoading && showIcon && Icon && <Icon className="size-4" />}
      {showText && <span>{label}</span>}
    </Button>
  );
}
