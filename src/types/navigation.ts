import type { LucideIcon } from "lucide-react";

export interface INavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  children?: INavItem[];
}

export interface ISidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}
