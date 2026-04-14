import { Mail, MapPin, Clock, MessageSquare } from "lucide-react";
import { GlassCard } from "@/components/shared";
import { ContactForm } from "@/components/forms/contact-form";

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    detail: "support@veriza.io",
    description: "We typically respond within 24 hours.",
  },
  {
    icon: MapPin,
    title: "Location",
    detail: "Kigali, Rwanda",
    description: "Serving organizations across the region.",
  },
  {
    icon: Clock,
    title: "Support Hours",
    detail: "Mon – Fri, 8AM – 5PM CAT",
    description: "Enterprise clients receive priority support.",
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-olive-50/80 via-stone-100 to-lime-50/40" />
        <div className="absolute -top-40 -right-40 -z-10 size-96 rounded-full bg-olive-200/30 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-olive-100/80 px-4 py-1.5 text-sm font-medium text-olive-700 backdrop-blur-sm">
              <MessageSquare className="size-3.5" />
              Contact Us
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
              Get In <span className="text-gradient-olive">Touch</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-stone-500">
              Have a question, need support, or want to discuss enterprise
              deployment? Our team is here to help.
            </p>
          </div>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-20 bg-white/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <GlassCard>
                <ContactForm />
              </GlassCard>
            </div>
            <div className="space-y-4 lg:col-span-2">
              {contactInfo.map((info) => (
                <GlassCard key={info.title}>
                  <div className="flex items-start gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-olive-100 text-olive-600">
                      <info.icon className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-stone-900">
                        {info.title}
                      </h4>
                      <p className="text-sm font-medium text-olive-700">
                        {info.detail}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {info.description}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
