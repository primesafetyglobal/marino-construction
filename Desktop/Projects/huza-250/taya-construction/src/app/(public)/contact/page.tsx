import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SITE, whatsappHref } from "@/config/site";
import { buttonClass } from "@/components/ui/button";
import { Container, PageHero } from "@/components/public/section";
import { RequestButton } from "@/components/public/request-sheet";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  const rows = [
    { icon: Phone, label: "Phone", value: SITE.contact.phone, href: SITE.contact.phoneHref },
    { icon: Mail, label: "Email", value: SITE.contact.email, href: SITE.contact.emailHref },
    { icon: MapPin, label: "Address", value: SITE.contact.address, href: null },
  ];
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us" intro="For a quotation or any question about our eight divisions.">
        <RequestButton size="lg">Request a quote</RequestButton>
        <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={buttonClass("light", "lg")}>
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      </PageHero>
      <Container className="grid gap-8 py-14 lg:grid-cols-2">
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line/50 p-5">
              <r.icon className="mt-0.5 h-5 w-5" />
              <div>
                <p className="text-sm text-muted">{r.label}</p>
                {r.href ? (
                  <a href={r.href} className="text-lg font-semibold hover:underline">
                    {r.value}
                  </a>
                ) : (
                  <p className="text-lg font-semibold">{r.value}</p>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line/50 p-5">
            <Clock className="mt-0.5 h-5 w-5" />
            <div>
              <p className="text-sm text-muted">Working hours</p>
              {SITE.contact.hours.map((h) => (
                <p key={h.days} className="font-medium">
                  {h.days}: {h.time}
                </p>
              ))}
            </div>
          </div>
        </div>
        <iframe title="Map" src={SITE.contact.mapEmbedUrl} className="min-h-80 w-full rounded-[var(--radius-card)] border border-line/50" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </Container>
    </>
  );
}
