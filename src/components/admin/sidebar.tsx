"use client";
// Admin shell (Design §4): grouped sidebar with live counters, collapsible to
// an icon rail (remembered per browser), mobile drawer; top bar with global
// search (⌘K / Ctrl K), quick "New request" and the user menu with role.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CreditCard,
  FolderOpen,
  FolderTree,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Plus,
  Search,
  Store,
  Truck,
  UserCircle,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/public/logo";
import { CommandPalette, type PaletteLink } from "./command-palette";

export type SidebarCounters = Partial<Record<string, number>>;

type Item = { href: string; label: string; icon: typeof Truck; count?: string; show?: boolean; alert?: boolean };

const ROLE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", STAFF: "Staff" };

export function AdminShell({ user, counters, canUsers, canFiles = false, children }: { user: { name: string; email: string; role: string }; counters: SidebarCounters; canUsers: boolean; canFiles?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const [palette, setPalette] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Remembered rail state (per browser; storage may be blocked).
  useEffect(() => {
    try {
      if (localStorage.getItem("admin-rail") === "1") setRail(true);
    } catch {}
  }, []);
  const toggleRail = () =>
    setRail((r) => {
      try {
        localStorage.setItem("admin-rail", r ? "0" : "1");
      } catch {}
      return !r;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!userMenu) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setUserMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUserMenu(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenu]);

  const groups: { title: string; items: Item[] }[] = [
    { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Requests",
      items: [
        { href: "/admin/equipment-requests", label: "Equipment", icon: Truck, count: "newEquipmentRequests" },
        { href: "/admin/supply-orders", label: "Supply orders", icon: Package, count: "newSupplyOrders" },
        { href: "/admin/service-requests", label: "Services", icon: Wrench, count: "newServiceRequests" },
        { href: "/admin/workforce-requests", label: "Workforce", icon: HardHat, count: "newWorkforceRequests" },
      ],
    },
    {
      title: "Catalog",
      items: [
        { href: "/admin/catalog/equipment", label: "Equipment", icon: Truck, count: "pendingEquipment", alert: true },
        { href: "/admin/catalog/products", label: "Products", icon: Boxes },
        { href: "/admin/catalog/services", label: "Services", icon: Wrench },
        { href: "/admin/catalog/trainings", label: "Trainings", icon: GraduationCap },
        { href: "/admin/catalog/categories", label: "Categories", icon: FolderTree },
        { href: "/admin/filing", label: "Files", icon: FolderOpen, show: canFiles },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/admin/clients", label: "Clients", icon: Users },
        { href: "/admin/vendors", label: "Vendors", icon: Store, count: "pendingVendors", alert: true },
        { href: "/admin/applicants", label: "Applicants", icon: ClipboardList, count: "newApplications" },
      ],
    },
    { title: "Payments", items: [{ href: "/admin/payments", label: "Payments", icon: CreditCard, count: "overdue", alert: true }] },
    { title: "Reviews", items: [{ href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote, count: "newReviews" }] },
    { title: "Users", items: [{ href: "/admin/users", label: "Users", icon: UserCog, show: canUsers }] },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));
  const links: PaletteLink[] = [
    ...groups.flatMap((g) => g.items.filter((i) => i.show !== false).map((i) => ({ href: i.href, label: i.label, group: g.title }))),
    { href: "/admin/requests/new", label: "New request", group: "Requests" },
    { href: "/admin/account", label: "My account", group: "You" },
  ];

  const nav = (compact: boolean) => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Dashboard">
      {groups.map((g) => {
        const items = g.items.filter((i) => i.show !== false);
        if (!items.length) return null;
        return (
          <div key={g.title}>
            {!compact && <p className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-white/40 uppercase">{g.title}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => {
                const n = i.count ? counters[i.count] : undefined;
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      title={compact ? i.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-[10px] py-2 text-sm transition-colors duration-150",
                        compact ? "justify-center px-0" : "px-3",
                        active ? "bg-white/[0.08] font-semibold text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-brand" aria-hidden />}
                      <i.icon className="h-[18px] w-[18px] shrink-0" />
                      {!compact && <span className="flex-1 truncate">{i.label}</span>}
                      {!!n && n > 0 && (
                        <span
                          className={cn(
                            "num rounded-md px-1.5 py-px text-[11px] font-semibold",
                            compact && "absolute -top-0.5 right-0.5 px-1 text-[9px]",
                            i.alert && i.count === "overdue" ? "bg-danger text-white" : "bg-brand text-charcoal",
                          )}
                        >
                          {n}
                          {compact ? "" : <span className="sr-only"> pending</span>}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-50 hidden flex-col bg-charcoal transition-[width] duration-200 lg:flex", rail ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-16 items-center border-b border-white/[0.07]", rail ? "justify-center" : "px-5")}>
          <Link href="/admin" aria-label="Marino dashboard home" className="rounded-md">
            {rail ? <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-display text-sm font-black text-charcoal">M</span> : <Logo dark />}
          </Link>
        </div>
        {nav(rail)}
        <button onClick={toggleRail} className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3 text-xs text-white/50 hover:text-white" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}>
          {rail ? <ChevronsRight className="mx-auto h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 animate-fade bg-charcoal/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-fade flex-col bg-charcoal" aria-label="Menu">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo dark />
              <button className="rounded-md p-1 text-white/70" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", rail ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 lg:px-8">
          <button aria-label="Open menu" className="rounded-md p-1 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <button
            onClick={() => setPalette(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-input)] border border-line-strong bg-canvas px-3 text-sm text-muted transition-colors hover:border-ink/30 sm:max-w-md"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search clients, vendors, equipment…</span>
            <kbd className="num ml-auto hidden rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] sm:inline">⌘K</kbd>
          </button>
          <Link href="/admin/requests/new" className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] border border-brand-hover/40 bg-brand px-3 text-sm font-semibold text-charcoal hover:bg-brand-hover sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New request</span>
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenu((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenu}
              className="flex items-center gap-2 rounded-[var(--radius-input)] p-1 pr-2 hover:bg-canvas"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-charcoal font-display text-xs font-semibold text-brand">
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")}
              </span>
              <span className="hidden text-left md:block">
                <span className="block max-w-36 truncate text-sm leading-tight font-medium">{user.name}</span>
                <span className="block text-[11px] leading-tight text-muted">{ROLE[user.role] ?? user.role}</span>
              </span>
            </button>
            {userMenu && (
              <div role="menu" className="absolute right-0 mt-2 w-60 animate-fade-up rounded-[12px] border border-line bg-white p-1 shadow-lift">
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                  <span className="mt-1.5 inline-block rounded-md bg-brand-tint px-1.5 py-0.5 text-[11px] font-semibold">{ROLE[user.role] ?? user.role}</span>
                </div>
                <Link role="menuitem" href="/admin/account" onClick={() => setUserMenu(false)} className="mt-1 flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm hover:bg-canvas">
                  <UserCircle className="h-4 w-4" /> My account
                </Link>
                <button role="menuitem" onClick={() => signOut({ callbackUrl: "/login" })} data-testid="sign-out" className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-sm hover:bg-canvas">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} links={links} />
    </div>
  );
}
