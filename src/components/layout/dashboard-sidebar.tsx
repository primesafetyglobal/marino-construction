"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DASHBOARD_SIDEBAR_ITEMS } from "@/config/sidebar";

export function DashboardSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-stone-200/50 px-5">
        <Image src="/logos/logo.png" alt="Veriza" width={28} height={28} className="size-7" />
        <span className="text-lg font-bold text-stone-900">Veriza</span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {DASHBOARD_SIDEBAR_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-olive-700 text-white shadow-sm"
                  : "text-stone-600 hover:bg-olive-50 hover:text-olive-700"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {item.badge && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-olive-100 text-[10px] font-semibold text-olive-700">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-stone-200/50 p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600">
          <LogOut className="size-4" />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-white/80 p-2 shadow-sm backdrop-blur-sm lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-5 text-stone-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform glass transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
          aria-label="Close sidebar"
        >
          <X className="size-4" />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-stone-200/50 bg-white/50 backdrop-blur-md lg:block">
        {navContent}
      </aside>
    </>
  );
}
