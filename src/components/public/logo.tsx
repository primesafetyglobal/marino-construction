import Image from "next/image";
import { SITE } from "@/config/site";
import { cn } from "@/lib/cn";

// Client logo (public/logos): the "M" mark, name and tagline, 4:1. Its text is
// charcoal on transparent, so on dark surfaces it sits on a white chip.
const SRC = "/logos/MARINO_Logo.webp";
const WIDTH = 1600;
const HEIGHT = 400;

export function Logo({ dark = false, className, priority = false }: { dark?: boolean; className?: string; priority?: boolean }) {
  return (
    <span className={cn("flex items-center select-none", dark && "rounded-lg bg-white px-2 py-1")}>
      <Image src={SRC} alt={SITE.name} width={WIDTH} height={HEIGHT} priority={priority} className={cn("h-10 w-auto", className)} />
    </span>
  );
}

// Just the "M" mark (the left quarter of the logo), for tight spaces like the collapsed admin rail.
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-white select-none", className)}>
      {/* At h-6 the image is 96px wide; the mark is its first 24px. */}
      <span className="block w-6 overflow-hidden">
        <Image src={SRC} alt={SITE.shortName} width={WIDTH} height={HEIGHT} className="h-6 w-auto max-w-none" />
      </span>
    </span>
  );
}
