import { EPricingTier } from "@/types";
import type { IPricingPlan } from "@/types";

export const PRICING_PLANS: IPricingPlan[] = [
  {
    tier: EPricingTier.Free,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Quick public signing with no account required.",
    features: [
      "Sign up to 5 documents/month",
      "Basic PDF signing",
      "Download signed documents",
      "Public verification",
    ],
    ctaLabel: "Sign Now",
    ctaHref: "/sign",
  },
  {
    tier: EPricingTier.Individual,
    name: "Individual",
    price: "$9",
    period: "per month",
    description: "Everything you need for personal document signing.",
    features: [
      "Unlimited document signing",
      "Signature styles (draw, type, upload)",
      "Document management",
      "Verification history",
      "Email invitations",
      "Priority support",
    ],
    highlighted: true,
    ctaLabel: "Get Started",
    ctaHref: "/register",
  },
  {
    tier: EPricingTier.Business,
    name: "Business",
    price: "$29",
    period: "per user/month",
    description: "Team signing workflows with audit and compliance.",
    features: [
      "Everything in Individual",
      "Bulk signing",
      "Multi-signer support",
      "Audit logs",
      "Team management",
      "API access",
      "Compliance reports",
      "Dedicated support",
    ],
    ctaLabel: "Contact Sales",
    ctaHref: "/contact",
  },
];
