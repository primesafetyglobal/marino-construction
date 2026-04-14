"use client";

import { Trash2, Layers, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ISignatureZone } from "@/types";

interface ZonesPanelProps {
  zones: ISignatureZone[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function ZonesPanel({ zones, selectedId, onSelect, onDelete, className }: ZonesPanelProps) {
  if (zones.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 px-4 text-center", className)}>
        <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100 mb-2">
          <MousePointerClick className="size-5 text-stone-400" />
        </div>
        <p className="text-xs font-medium text-stone-500">No signature zones</p>
        <p className="mt-0.5 text-[10px] text-stone-400">
          Click on the document to place a signature zone
        </p>
      </div>
    );
  }

  // Group by page
  const grouped: Record<number, ISignatureZone[]> = {};
  zones.forEach((z) => {
    if (!grouped[z.pageIndex]) grouped[z.pageIndex] = [];
    grouped[z.pageIndex].push(z);
  });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          <Layers className="size-3" />
          Zones ({zones.length})
        </div>
      </div>

      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([page, pageZones]) => (
          <div key={page}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Page {page}
            </p>
            <div className="space-y-1">
              {pageZones.map((zone, idx) => {
                const isSelected = selectedId === zone.id;
                return (
                  <div
                    key={zone.id}
                    onClick={() => onSelect(zone.id)}
                    className={cn(
                      "group flex items-center justify-between rounded-lg border p-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-olive-400 bg-olive-50/60"
                        : "border-stone-200/60 bg-white/40 hover:border-olive-300 hover:bg-olive-50/20"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold",
                          isSelected ? "bg-olive-500 text-white" : "bg-stone-200 text-stone-500"
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-stone-700 truncate">
                          {zone.label || "Signature Zone"}
                        </p>
                        <p className="text-[9px] font-mono text-stone-400">
                          {Math.round(zone.width)}×{Math.round(zone.height)}pt
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(zone.id);
                      }}
                      className={cn(
                        "shrink-0 rounded-md p-1 transition-all",
                        isSelected
                          ? "text-red-400 hover:bg-red-50"
                          : "text-transparent group-hover:text-stone-400 group-hover:hover:text-red-400"
                      )}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
