import type { EPricingTier } from "./enums";

export interface IPricingPlan {
  tier: EPricingTier;
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
  ctaHref: string;
}
