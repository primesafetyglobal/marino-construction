import Link from "next/link";
import Image from "next/image";
import { Shield, Mail, MapPin } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Security", href: "/security" },
    { label: "How It Works", href: "/how-it-works" },
  ],
  resources: [
    { label: "FAQs", href: "/faqs" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Benefits", href: "/benefits" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-stone-200/50 bg-stone-900 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logos/logo.png"
                alt="Veriza"
                width={28}
                height={28}
                className="size-7"
              />
              <span className="text-lg font-bold text-white">Veriza</span>
            </Link>
            <p className="text-sm leading-relaxed text-stone-400">
              Secure PKI-powered digital signing for individuals and organizations.
            </p>
            <div className="flex flex-col gap-2 text-sm text-stone-400">
              <span className="flex items-center gap-2">
                <Mail className="size-3.5" /> support@veriza.io
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="size-3.5" /> Worldwide
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Product</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-400 transition-colors hover:text-olive-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-400 transition-colors hover:text-olive-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-stone-400 transition-colors hover:text-olive-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-stone-500">
              <Shield className="size-3.5 text-olive-500" />
              PKI Secured
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-stone-700/50 pt-6 text-center text-xs text-stone-500">
          &copy; {new Date().getFullYear()} Veriza. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
