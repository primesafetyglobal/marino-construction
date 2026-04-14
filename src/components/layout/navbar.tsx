"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, FileSignature, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV_ITEMS } from "@/config/navigation";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/15 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logos/logo.png"
            alt="Veriza"
            width={32}
            height={32}
            className="size-8"
          />
          <span className="text-xl font-bold tracking-tight text-stone-900">
            Veriza
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-olive-50 hover:text-olive-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/sign"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-olive-50 hover:text-olive-700"
          >
            <FileSignature className="size-4" />
            Sign
          </Link>
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-olive-50 hover:text-olive-700"
          >
            <ShieldCheck className="size-4" />
            Verify
          </Link>
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white/60 px-4 py-2 text-sm font-medium text-stone-700",
              "transition-colors hover:bg-stone-100 backdrop-blur-sm"
            )}
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-olive-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-olive-600"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-stone-600 lg:hidden hover:bg-stone-100"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-stone-200/50 glass lg:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-olive-50 hover:text-olive-700"
              >
                {item.label}
              </Link>
            ))}
            <hr className="my-2 border-stone-200" />
            <Link
              href="/sign"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-olive-50"
            >
              <FileSignature className="size-4" /> Sign a Document
            </Link>
            <Link
              href="/verify"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-olive-50"
            >
              <ShieldCheck className="size-4" /> Verify
            </Link>
            <hr className="my-2 border-stone-200" />
            <div className="flex gap-2 px-3">
              <Link
                href="/login"
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white/60 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-olive-700 px-4 py-2 text-sm font-medium text-white hover:bg-olive-600"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
