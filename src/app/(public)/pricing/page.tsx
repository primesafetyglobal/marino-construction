import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SectionHeading } from "@/components/shared";
import { PRICING_PLANS } from "@/config/pricing";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Simple, Transparent Pricing"
          subtitle="Start for free. Upgrade when you need more."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mx-auto max-w-5xl">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 backdrop-blur-md transition-all duration-300",
                plan.highlighted
                  ? "border-olive-500/40 bg-olive-50/50 shadow-lg shadow-olive-500/10 scale-[1.02]"
                  : "border-white/20 bg-white/50"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-olive-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-stone-900">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-900">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-stone-500">/{plan.period}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-stone-500">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-olive-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={cn(
                  "mt-6 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                  plan.highlighted
                    ? "bg-olive-700 text-white hover:bg-olive-600 shadow-md shadow-olive-700/20"
                    : "border border-stone-300 bg-white/60 text-stone-700 hover:bg-white"
                )}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
