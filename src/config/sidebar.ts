import {
  LayoutDashboard,
  FileSignature,
  ShieldCheck,
  FolderOpen,
  Mail,
  User,
} from "lucide-react";
import type { ISidebarItem } from "@/types";

export const DASHBOARD_SIDEBAR_ITEMS: ISidebarItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Sign", href: "/dashboard/sign", icon: FileSignature },
  { label: "Verify", href: "/dashboard/verify", icon: ShieldCheck },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen },
  { label: "Invitations", href: "/dashboard/invitations", icon: Mail },
  { label: "Profile", href: "/dashboard/profile", icon: User },
];
