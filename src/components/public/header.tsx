"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink, Mail, Menu, MessageCircle, Phone, Search, X } from "lucide-react";
import { DIVISIONS, type Division, type DivisionEnum } from "@/config/divisions";
import { SITE, whatsappHref } from "@/config/site";
import { cn } from "@/lib/cn";
import { DivisionIcon } from "@/components/ui/icons";
import { RequestButton } from "./request-sheet";
import { SearchBox } from "./search-box";
import { Logo } from "./logo";

export type MenuData = {
  categories: { name: string; slug: string; type: "EQUIPMENT" | "PRODUCT" | "SERVICE"; division: DivisionEnum }[];
  services: { name: string; slug: string; division: DivisionEnum }[];
};

const QUICK = [
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Jobs" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];

// What the flyout lists for a division: categories or services, one click away.
export function menuLinks(div: Division, menu: MenuData): { href: string; label: string; external?: boolean }[] {
  switch (div.variant) {
    case "equipment":
      return [
        ...menu.categories.filter((c) => c.type === "EQUIPMENT").map((c) => ({ href: `/equipment?category=${c.slug}`, label: c.name })),
        ...menu.services.filter((s) => s.division === "EQUIPMENT").map((s) => ({ href: `/services/${s.slug}`, label: s.name })),
        { href: "/equipment/list-yours", label: "Rent out / sell your equipment" },
      ];
    case "materials":
      return menu.categories.filter((c) => c.type === "PRODUCT").map((c) => ({ href: `/materials?category=${c.slug}`, label: c.name }));
    case "training":
      return [
        { href: "/training?type=HSE", label: "HSE trainings" },
        { href: "/training?type=CONSTRUCTION", label: "Construction trainings" },
        { href: SITE.links.verifyCertificate, label: "Verify a certificate", external: true },
      ];
    case "workforce":
      return [
        { href: "/workforce#request-workers", label: "Request workers" },
        { href: "/jobs", label: "Open jobs" },
      ];
    default:
      return [
        ...menu.services.filter((s) => s.division === div.enum).map((s) => ({ href: `/services/${s.slug}`, label: s.name })),
        ...(div.variant === "paint" ? [{ href: SITE.links.paintShop, label: "Buy paint in our shop", external: true }] : []),
      ];
  }
}

export function Header({ menu }: { menu: MenuData }) {
  const pathname = usePathname();
  const [hover, setHover] = useState<DivisionEnum | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close menus when the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setHover(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }

  const current = DIVISIONS.find((d) => d.enum === hover);

  return (
    <>
      {/* Top utility bar */}
      <div className="hidden bg-charcoal text-[13px] text-white/70 lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6">
          <p className="font-semibold text-brand">{SITE.tagline}</p>
          <div className="flex items-center gap-5">
            <a href={SITE.contact.phoneHref ?? "/contact"} className="flex items-center gap-1.5 hover:text-white">
              <Phone className="h-3.5 w-3.5" /> {SITE.contact.phone}
            </a>
            <a href={SITE.contact.emailHref ?? "/contact"} className="flex items-center gap-1.5 hover:text-white">
              <Mail className="h-3.5 w-3.5" /> {SITE.contact.email}
            </a>
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <span className="h-4 w-px bg-white/20" />
            {QUICK.map((q) => (
              <Link key={q.href} href={q.href} className="hover:text-white">
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky translucent header */}
      <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70" onMouseLeave={() => setHover(null)}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
          <Link href="/" aria-label="Marino Construction home" className="shrink-0">
            <Logo />
          </Link>
          <SearchBox className="ml-auto hidden w-72 xl:block" />
          <div className="ml-auto flex items-center gap-2 xl:ml-0">
            <button className="rounded-full p-2 hover:bg-mist xl:hidden" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
              <Search className="h-5 w-5" />
            </button>
            <RequestButton size="sm" className="hidden rounded-full sm:inline-flex" testId="header-request">
              Request a quote
            </RequestButton>
            <button className="rounded-full p-2 hover:bg-mist lg:hidden" aria-label="Menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* The 8 divisions, always visible on desktop */}
        <nav aria-label="Divisions" className="hidden border-t border-line/40 lg:block">
          <ul className="mx-auto flex max-w-7xl items-center justify-between px-6">
            {DIVISIONS.map((d) => (
              <li key={d.enum} onMouseEnter={() => setHover(d.enum)}>
                <Link
                  href={`/${d.slug}`}
                  onFocus={() => setHover(d.enum)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[13.5px] font-medium transition-colors",
                    pathname?.startsWith(`/${d.slug}`) || hover === d.enum ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  <DivisionIcon icon={d.icon} className="h-4 w-4" />
                  {d.shortName}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mega-menu flyout */}
        {current && (
          <div className="absolute inset-x-0 top-full hidden border-b border-line/50 bg-white/95 shadow-soft backdrop-blur-xl lg:block animate-fade">
            <div className="mx-auto grid max-w-7xl grid-cols-[260px_1fr] gap-10 px-6 py-8">
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">{current.tagline}</p>
                <p className="mt-2 text-2xl font-bold">{current.name}</p>
                <Link href={`/${current.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                  Explore {current.shortName} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-x-8 gap-y-1">
                {menuLinks(current, menu).map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[15px] text-ink hover:bg-mist">
                      {l.label}
                      {l.external && <ExternalLink className="h-3 w-3 text-muted" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {searchOpen && (
          <div className="border-t border-line/40 px-4 py-3 xl:hidden">
            <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      {/* Mobile full-screen menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white animate-fade lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-line/50 px-4">
            <Logo />
            <button aria-label="Close menu" className="rounded-full p-2 hover:bg-mist" onClick={() => setMobileOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-1.5">
              {DIVISIONS.map((d) => (
                <li key={d.enum}>
                  <Link href={`/${d.slug}`} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-mist">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint">
                      <DivisionIcon icon={d.icon} className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{d.name}</span>
                      <span className="block text-xs text-muted">{d.tagline}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-4 grid grid-cols-2 gap-2 border-t border-line/50 pt-4">
              {QUICK.map((q) => (
                <li key={q.href}>
                  <Link href={q.href} className="block rounded-xl bg-mist px-4 py-3 text-center font-medium">
                    {q.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
