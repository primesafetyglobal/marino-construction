"use client";

import { useState } from "react";
import { SmartImage, type PlaceholderIcon } from "@/components/ui/smart-image";
import { cn } from "@/lib/cn";

export function Gallery({ images, alt, icon, seed }: { images: string[]; alt: string; icon: PlaceholderIcon; seed: number }) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <SmartImage src={images[active]} alt={alt} icon={icon} seed={seed} priority sizes="(max-width: 1024px) 100vw, 55vw" className="aspect-[4/3] rounded-[var(--radius-card)]" />
      {images.length > 1 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src}>
              <button type="button" onClick={() => setActive(i)} aria-label={`Photo ${i + 1}`} className={cn("block overflow-hidden rounded-xl border-2", i === active ? "border-brand" : "border-transparent")}>
                <SmartImage src={src} alt="" icon={icon} className="h-16 w-20" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
