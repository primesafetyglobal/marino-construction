"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/20 bg-white/50 backdrop-blur-md overflow-hidden"
        >
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-stone-900 hover:bg-white/30 transition-colors"
          >
            {item.q}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-stone-400 transition-transform duration-200",
                openIndex === i && "rotate-180"
              )}
            />
          </button>
          {openIndex === i && (
            <div className="px-5 pb-4 text-sm leading-relaxed text-stone-500">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
