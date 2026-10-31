import Image from "next/image";
import { BrickWall, Building2, GraduationCap, HardHat, Image as ImageIcon, PaintRoller, Recycle, SearchCheck, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = { Truck, GraduationCap, SearchCheck, BrickWall, Recycle, HardHat, Building2, PaintRoller, Wrench, ImageIcon } as const;
export type PlaceholderIcon = keyof typeof ICONS;

// Warm, light placeholders in the site palette (sand, golden, clay).
const TONES = [
  "from-[#f3e8d2] to-[#fbf6ec]",
  "from-[#ffe9a8] to-[#fff6db]",
  "from-[#ead2bf] to-[#fbf6ec]",
  "from-[#f6e3c4] to-[#fffaf0]",
];

// Real photos drop in later: with a src the image is shown through next/image;
// without one, a neutral gradient block with an icon (no stock photos exist yet).
export function SmartImage({
  src,
  alt,
  icon = "ImageIcon",
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority,
  seed = 0,
}: {
  src?: string | null;
  alt: string;
  icon?: PlaceholderIcon;
  className?: string;
  sizes?: string;
  priority?: boolean;
  seed?: number;
}) {
  if (src) {
    const hosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(",").filter(Boolean);
    let optimised = false;
    try {
      optimised = hosts.includes(new URL(src).host);
    } catch {
      optimised = false;
    }
    return (
      <div className={cn("relative overflow-hidden bg-mist", className)}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={!optimised} className="object-cover" />
      </div>
    );
  }
  const Icon = ICONS[icon];
  const tone = TONES[Math.abs(seed) % TONES.length];
  return (
    <div role="img" aria-label={alt} className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br", tone, className)}>
      <div className="absolute inset-0 text-earth opacity-[0.07] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:14px_14px]" />
      <Icon className="relative h-1/4 max-h-16 w-1/4 max-w-16 text-earth/50" />
    </div>
  );
}

export function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}
