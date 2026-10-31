import Link from "next/link";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { DIVISIONS } from "@/config/divisions";
import { SITE, whatsappHref } from "@/config/site";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-sand-deep bg-sand pb-24 text-muted lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm">{SITE.description}</p>
          <a href={SITE.links.verifyCertificate} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "sm")}>
            <BadgeCheck className="h-4 w-4" /> Verify certificate
          </a>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">Divisions</p>
          <ul className="space-y-1.5 text-sm">
            {DIVISIONS.map((d) => (
              <li key={d.slug}>
                <Link href={`/${d.slug}`} className="hover:text-earth">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">Quick links</p>
          <ul className="space-y-1.5 text-sm">
            {[
              ["/about", "About us"],
              ["/jobs", "Jobs"],
              ["/reviews", "Reviews"],
              ["/equipment/list-yours", "List your equipment"],
              ["/partner-with-us", "Partner with us"],
              ["/contact", "Contact us"],
              ["/login", "Staff login"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-earth">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 text-sm">
          <p className="font-semibold text-ink">Contact</p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-earth" /> {SITE.contact.address}
          </p>
          <p>{SITE.contact.phone}</p>
          <p>{SITE.contact.email}</p>
          <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="block hover:text-earth">
            WhatsApp
          </a>
          <div>
            <p className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <Clock className="h-4 w-4 text-earth" /> Working hours
            </p>
            {SITE.contact.hours.map((h) => (
              <p key={h.days}>
                {h.days}: {h.time}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {SITE.socials.map((s) => (
              <a key={s.label} href={s.href} className="hover:text-earth">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-sand-deep">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs lg:px-6">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
