import type { INavItem } from "@/types";

export const PUBLIC_NAV_ITEMS: INavItem[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
//   { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Benefits", href: "/benefits" },
  { label: "Services", href: "/services" },
//   { label: "Security", href: "/security" },
//   { label: "FAQs", href: "/faqs" },
//   { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const AUTH_NAV_ITEMS: INavItem[] = [
  { label: "Sign", href: "/sign" },
  { label: "Verify", href: "/verify" },
];
