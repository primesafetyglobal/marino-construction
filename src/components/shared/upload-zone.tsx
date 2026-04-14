"use client";

import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  label?: string;
  accept?: string;
  onFileSelect?: (file: File) => void;
  className?: string;
}

export function UploadZone({
  label = "Drop your PDF here or click to upload",
  accept = ".pdf",
  onFileSelect,
  className,
}: UploadZoneProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect?.(file);
  };

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300",
        "bg-white/40 px-6 py-12 cursor-pointer backdrop-blur-sm",
        "transition-all duration-200 hover:border-olive-500 hover:bg-olive-50/30",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
        <Upload className="size-5" />
      </div>
      <p className="text-sm text-stone-500 text-center">{label}</p>
      <p className="text-xs text-stone-400">PDF files only, up to 25MB</p>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  );
}
