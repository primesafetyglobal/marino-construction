import { BrickWall, Building2, GraduationCap, HardHat, PaintRoller, Recycle, SearchCheck, Truck } from "lucide-react";
import type { Division } from "@/config/divisions";

const MAP = { Truck, GraduationCap, SearchCheck, BrickWall, Recycle, HardHat, Building2, PaintRoller } as const;

export function DivisionIcon({ icon, className }: { icon: Division["icon"]; className?: string }) {
  const Icon = MAP[icon];
  return <Icon className={className} aria-hidden />;
}
