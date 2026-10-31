// SITE CONFIG: contacts, socials, home page figures and outside links (D-10).
// CLIENT-SAFE: header, footer and pages import it. Edited by developers only
// (Project Details §8: no editable site content in v1).
//
// Placeholders stay until the client sends the real values.

export const SITE = {
  name: "Marino Construction and Supply Solutions Ltd",
  shortName: "Marino Construction",
  domain: "marino-construction.rw",
  url: "https://marino-construction.rw",
  tagline: "Everything Your Project Needs",
  description:
    "Equipment, materials, inspections, trainings, waste management, workforce, engineering and Paint Rwanda: one group for every construction need in Rwanda.",
  contact: {
    phone: "0780795232",
    phoneHref: null as string | null, // e.g. "tel:+250788000000" once known
    email: "info@marino-construction.rw",
    emailHref: null as string | null,
    // WhatsApp click-to-chat number in international format without "+", once known.
    whatsappNumber: null as string | null,
    address: "Kigali, Rwanda",
    hours: [
      { days: "Monday to Friday", time: "8:00 - 18:00" },
      { days: "Saturday", time: "8:00 - 13:00" },
      { days: "Sunday", time: "Closed" },
    ],
    mapEmbedUrl: "https://www.google.com/maps?q=Kigali%2C%20Rwanda&output=embed",
  },
  socials: [
    { label: "Facebook", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "LinkedIn", href: "#" },
    { label: "X", href: "#" },
  ],
  // Home "Our achievements" strip (placeholders to confirm with the client).
  achievements: [
    { label: "Years in business", value: "10+" },
    { label: "Equipment rented", value: "1,200+" },
    { label: "Trained staff", value: "5,000+" },
    { label: "Inspections conducted", value: "800+" },
    { label: "Waste valorised (tonnes)", value: "3,500" },
    { label: "Projects completed", value: "450+" },
  ],
  links: {
    // Prime Safety Global (same owner): trainings and certificate checks. URL to confirm.
    primeSafetyGlobal: "https://primesafetyglobal.com",
    verifyCertificate: "https://primesafetyglobal.com",
    // Paint Rwanda shop link (to confirm with the client).
    paintShop: "https://primesafetyglobal.com",
  },
} as const;

export function whatsappHref(message?: string): string {
  const base = SITE.contact.whatsappNumber ? `https://wa.me/${SITE.contact.whatsappNumber}` : "https://wa.me/";
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
