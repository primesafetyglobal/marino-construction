// DEMO SEED: clearly fake data (every name starts with "Demo") so every screen
// can be previewed. Runs once: if the demo marker client exists, it stops.

import type { PrismaClient } from "../prisma/src/generated/prisma/client";

const MARKER = "demo.builders@example.com";
const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const logo = (text: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" rx="10" fill="${color}"/><text x="100" y="37" font-family="Arial" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">${text}</text></svg>`)}`;

export async function seedDemo(db: PrismaClient) {
  if (await db.client.findUnique({ where: { email: MARKER } })) {
    console.log("Demo data already present. Nothing to do.");
    return;
  }
  const cat = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const svc = new Map((await db.service.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));
  const c = (slug: string) => cat.get(slug)!;

  // Vendors: 2 partners (one supplier with a shop link), 1 approved garage, 1 pending.
  const owner = await db.vendor.create({ data: { name: "Demo Kigali Heavy Machines", companyName: "Demo Kigali Heavy Machines Ltd", entityType: "COMPANY", tin: "100000001", phone: "+250788900001", type: "EQUIPMENT_OWNER", district: "Gasabo", offerings: "Excavators, loaders and cranes for rent", status: "APPROVED", isPartner: true, logo: logo("Demo KHM", "#16181D") } });
  await db.vendor.create({ data: { name: "Demo Building Supplies", companyName: "Demo Building Supplies Co", entityType: "COMPANY", email: "demo.supplies@example.com", type: "SUPPLIER", district: "Kicukiro", offerings: "Cement, tiles, paint", status: "APPROVED", isPartner: true, website: "https://example.com/demo-shop", logo: logo("Demo Supplies", "#C28A00") } });
  await db.vendor.create({ data: { name: "Demo Garage Remera", phone: "+250788900003", type: "GARAGE", district: "Gasabo", offerings: "Heavy equipment servicing", status: "APPROVED" } });
  await db.vendor.create({ data: { name: "Demo Pending Recycler", email: "demo.recycler@example.com", type: "RECYCLER", district: "Nyarugenge", offerings: "Scrap metal and timber recovery", status: "PENDING" } });

  const eq = (slug: string, name: string, category: string, extra: Record<string, unknown>) =>
    db.equipment.create({
      data: { slug, name, categoryId: c(category), description: `${name}: well maintained, available with or without operator. Demo listing.`, images: [], location: "Kigali", specs: [{ label: "Year", value: "2019" }, { label: "Fuel", value: "Diesel" }], ...extra },
    });
  const excavator = await eq("demo-cat-320-excavator", "Demo CAT 320 Excavator", "excavators", { forRent: true, rentPrice: 450000, rentUnit: "DAY", status: "AVAILABLE", isFeatured: true, ownerId: owner.id, specs: [{ label: "Operating weight", value: "20 t" }, { label: "Year", value: "2019" }, { label: "Fuel", value: "Diesel" }] });
  await eq("demo-wheel-loader", "Demo Wheel Loader 966", "loaders", { forRent: true, rentPrice: 380000, rentUnit: "DAY", status: "AVAILABLE", isFeatured: true });
  await eq("demo-bulldozer-d6", "Demo Bulldozer D6", "bulldozers", { forRent: true, rentPrice: 500000, rentUnit: "DAY", forSale: true, salePrice: 95000000, status: "AVAILABLE", isFeatured: true });
  await eq("demo-motor-grader", "Demo Motor Grader 140", "graders", { forRent: true, rentPrice: 420000, rentUnit: "DAY", status: "AVAILABLE" });
  await eq("demo-vibratory-roller", "Demo Vibratory Roller 10t", "rollers-compactors", { forRent: true, rentPrice: 250000, rentUnit: "DAY", status: "AVAILABLE", isFeatured: true });
  const tipper = await eq("demo-tipper-truck-20t", "Demo Tipper Truck 20t", "dump-tipper-trucks", { forRent: true, rentPrice: 1500000, rentUnit: "WEEK", status: "RENTED" });
  const mixer = await eq("demo-concrete-mixer-350l", "Demo Concrete Mixer 350L", "concrete-mixers", { forSale: true, salePrice: 3200000, status: "AVAILABLE" });
  await eq("demo-mobile-crane-25t", "Demo Mobile Crane 25t", "cranes-lifting", { forRent: true, rentPrice: 900000, rentUnit: "DAY", status: "PENDING", ownerId: owner.id });

  const pr = (slug: string, name: string, category: string, unit: "PIECE" | "BAG" | "M2" | "M3" | "TON" | "LITRE" | "TRIP", price: number | null, isFeatured = false) =>
    db.product.create({ data: { slug, name, categoryId: c(category), description: `${name}. Demo product for preview.`, images: [], unit, price, isFeatured } });
  await pr("demo-river-sand", "Demo River Sand", "aggregates", "TRIP", 120000, true);
  await pr("demo-gravel-3-4", "Demo Gravel 3/4", "aggregates", "TRIP", 150000);
  await pr("demo-concrete-blocks-15", "Demo Concrete Blocks 15 cm", "concrete-bricks", "PIECE", 800, true);
  const paint = await pr("demo-interior-emulsion-20l", "Demo Interior Emulsion 20 L", "paints-finishes", "PIECE", 45000, true);
  await pr("demo-exterior-weatherguard-20l", "Demo Exterior Weatherguard 20 L", "paints-finishes", "PIECE", 62000);
  const tiles = await pr("demo-floor-tiles-60x60", "Demo Floor Tiles 60×60", "tiles", "M2", 18000, true);
  await pr("demo-liquid-waterproofing", "Demo Liquid Waterproofing 20 kg", "waterproofing-insulation", "PIECE", null);
  await pr("demo-tile-adhesive-25kg", "Demo Tile Adhesive 25 kg", "chemicals-adhesives", "BAG", 14000);

  const psg = "https://primesafetyglobal.com";
  for (const [slug, title, type, duration] of [
    ["demo-working-at-height", "Demo Working at Height", "HSE", "2 days"],
    ["demo-first-aid-fire-safety", "Demo First Aid & Fire Safety", "HSE", "3 days"],
    ["demo-excavator-operator", "Demo Excavator Operator Course", "CONSTRUCTION", "10 days"],
    ["demo-site-supervision", "Demo Site Supervision", "CONSTRUCTION", "5 days"],
  ] as const) {
    await db.training.create({ data: { slug, title, type, duration, summary: `${title}: practical course delivered and certified by Prime Safety Global.`, externalUrl: psg, isFeatured: true, isPublished: true } });
  }

  const jean = await db.client.create({ data: { name: "Demo Client Jean", phone: "+250788000001", district: "Kicukiro" } });
  const builders = await db.client.create({ data: { name: "Demo Contact Eric", email: MARKER, entityType: "COMPANY", companyName: "Demo Builders Ltd", tin: "100000002", district: "Gasabo" } });
  const aline = await db.client.create({ data: { name: "Demo Client Aline", email: "demo.aline@example.com", district: "Nyarugenge" } });

  await db.equipmentRequest.create({ data: { type: "RENT", clientId: jean.id, equipmentId: excavator.id, details: "Foundation excavation, about 5 days with operator.", siteLocation: "Kicukiro, Kigali", startDate: day(7), endDate: day(12) } });
  await db.equipmentRequest.create({ data: { type: "RENT", clientId: builders.id, equipmentId: tipper.id, details: "Hauling for a road project.", siteLocation: "Bugesera", startDate: day(-5), endDate: day(23), quotedAmount: 6000000, status: "ACTIVE", source: "PHONE" } });
  await db.equipmentRequest.create({ data: { type: "BUY", clientId: aline.id, equipmentId: mixer.id, details: "Would like to buy the mixer.", siteLocation: "Nyarugenge", quotedAmount: 3200000, status: "QUOTED" } });
  await db.supplyOrder.create({ data: { clientId: jean.id, productId: tiles.id, items: "Demo Floor Tiles 60×60: 120 m²", deliveryLocation: "Kicukiro" } });
  await db.supplyOrder.create({ data: { clientId: builders.id, items: "10 trips river sand, 400 bags cement", deliveryLocation: "Gasabo", quotedAmount: 4800000, status: "DELIVERED", source: "WHATSAPP" } });
  await db.serviceRequest.create({ data: { clientId: builders.id, serviceId: svc.get("structural-inspections")!, details: "Structural condition assessment of a 4-storey building.", siteLocation: "Nyarugenge, Kigali", preferredDate: day(10), status: "SCHEDULED", quotedAmount: 850000 } });
  const painting = await db.serviceRequest.create({
    data: { clientId: aline.id, serviceId: svc.get("professional-painting")!, details: "Paint a 3-bedroom house, interior and exterior.", siteLocation: "Kimironko, Gasabo", paymentPlan: "INSTALLMENT", quotedAmount: 450000, status: "IN_PROGRESS" },
  });
  await db.payment.createMany({
    data: [
      { serviceRequestId: painting.id, amount: 150000, status: "PAID", method: "MOMO", paidAt: day(-20), dueDate: day(-20), reference: "DEMO-MOMO-1" },
      { serviceRequestId: painting.id, amount: 150000, status: "DUE", dueDate: day(-10) },
      { serviceRequestId: painting.id, amount: 150000, status: "DUE", dueDate: day(20) },
    ],
  });
  void paint;

  const job = await db.workforceRequest.create({
    data: {
      clientId: builders.id,
      role: "Demo Steel fixers",
      quantity: 10,
      duration: "3 months",
      siteLocation: "Kicukiro, Kigali",
      startDate: day(14),
      isPublished: true,
      status: "RECRUITING",
      deadline: day(30),
      jobDescription: "We are recruiting experienced steel fixers for a residential building project in Kigali. At least 2 years of experience. Daily pay, site meals.",
    },
  });
  await db.workforceRequest.create({ data: { clientId: jean.id, role: "Demo Masons", quantity: 4, duration: "6 weeks", siteLocation: "Kicukiro" } });
  const eric = await db.applicant.create({ data: { fullName: "Demo Applicant Eric", phone: "+250788100001", dateOfBirth: new Date("1995-05-10T00:00:00Z"), gender: "MALE", trade: "Steel fixer", experience: "5 years on residential and commercial sites.", district: "Gasabo", consentAt: new Date(), details: { languages: ["Kinyarwanda", "English"], skills: ["Rebar bending", "Reading drawings"] } } });
  const grace = await db.applicant.create({ data: { fullName: "Demo Applicant Grace", email: "demo.grace@example.com", dateOfBirth: new Date("1998-11-02T00:00:00Z"), gender: "FEMALE", trade: "Steel fixer", experience: "3 years.", district: "Kicukiro", consentAt: new Date() } });
  await db.jobApplication.createMany({ data: [{ workforceRequestId: job.id, applicantId: eric.id, message: "Available from next week." }, { workforceRequestId: job.id, applicantId: grace.id, status: "SHORTLISTED" }] });

  await db.review.createMany({
    data: [
      { fullName: "Demo Reviewer Patrick", company: "Demo Builders Ltd", clientId: builders.id, division: "EQUIPMENT", rating: 5, message: "The tipper truck arrived on time and the team followed up every day. Great service.", status: "PUBLIC" },
      { fullName: "Demo Reviewer Aline", division: "PAINT_RWANDA", clientId: aline.id, rating: 5, message: "Paint now, pay later made it possible to refresh our whole house this year.", status: "PUBLIC" },
      { fullName: "Demo Reviewer Claude", company: "Demo Estates", division: "INSPECTION_TESTING", rating: 4, message: "Clear inspection report with practical recommendations.", status: "PUBLIC" },
      { fullName: "Demo Reviewer New", phone: "+250788000001", clientId: jean.id, division: "MATERIALS", rating: 3, message: "Good tiles, delivery could be faster.", status: "NEW" },
    ],
  });
  console.log("Demo data created (names start with “Demo”).");
}
