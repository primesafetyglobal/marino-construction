// Seed content: categories and services (Data Model §6), written from the
// client's text in docs/client/divisions-content.md. No server-only imports.

type Division = "EQUIPMENT" | "TRAINING" | "INSPECTION_TESTING" | "MATERIALS" | "WASTE_MANAGEMENT" | "WORKFORCE" | "ENGINEERING" | "PAINT_RWANDA";
type CategoryType = "EQUIPMENT" | "PRODUCT" | "SERVICE";
type Section =
  | { type: "text"; title: string; body: string }
  | { type: "list" | "steps"; title: string; items: string[] }
  | { type: "faq"; title: string; items: { q: string; a: string }[] };

export type SeedCategory = { name: string; slug: string; type: CategoryType; division: Division; description?: string };
export type SeedService = { category: string; name: string; slug: string; summary: string; description: string; content: Section[] };

const eq = (name: string, slug: string, description?: string): SeedCategory => ({ name, slug, type: "EQUIPMENT", division: "EQUIPMENT", description });
const pr = (name: string, slug: string, description: string): SeedCategory => ({ name, slug, type: "PRODUCT", division: "MATERIALS", description });

export const CATEGORIES: SeedCategory[] = [
  eq("Excavators", "excavators", "Excavators for earthworks, trenching and demolition."),
  eq("Loaders", "loaders", "Wheel loaders and backhoe loaders."),
  eq("Bulldozers", "bulldozers"),
  eq("Graders", "graders"),
  eq("Rollers & Compactors", "rollers-compactors"),
  eq("Cranes & Lifting", "cranes-lifting", "Cranes and lifting equipment."),
  eq("Dump & Tipper Trucks", "dump-tipper-trucks"),
  eq("Scaffolding & Formwork", "scaffolding-formwork"),
  eq("Concrete Mixers", "concrete-mixers"),
  eq("Generators & Compressors", "generators-compressors"),
  eq("Cars & SUVs", "cars-suvs"),
  eq("Pick-ups & Vans", "pickups-vans"),
  eq("Trucks & Commercial Vehicles", "trucks-commercial-vehicles"),
  pr("Aggregates", "aggregates", "Sand, gravel and other construction aggregates for concrete, construction and civil works."),
  pr("Concrete & Bricks", "concrete-bricks", "Concrete blocks, concrete pipes and bricks for building, drainage and structural works."),
  pr("Paints & Finishes", "paints-finishes", "Interior and exterior paints, waterproofing paints, wood coatings, primers and decorative wall textures."),
  pr("Tiles", "tiles", "Floor, wall, outdoor and parking tiles."),
  pr("Waterproofing & Insulation", "waterproofing-insulation", "Heat-reflective coatings, liquid waterproofing, PU foam and sealants."),
  pr("Chemicals & Adhesives", "chemicals-adhesives", "Adhesives, construction chemicals, sealants, tile adhesives and grouts."),
  { name: "Equipment Services", slug: "equipment-services", type: "SERVICE", division: "EQUIPMENT", description: "Spare parts and maintenance for vehicles and equipment." },
  { name: "Inspection & Testing", slug: "inspection-testing", type: "SERVICE", division: "INSPECTION_TESTING" },
  { name: "Waste Management", slug: "waste-management", type: "SERVICE", division: "WASTE_MANAGEMENT" },
  { name: "Engineering & Construction", slug: "engineering-construction", type: "SERVICE", division: "ENGINEERING" },
  { name: "Painting Solutions", slug: "painting-solutions", type: "SERVICE", division: "PAINT_RWANDA" },
];

const steps = (what: string): Section => ({
  type: "steps",
  title: "How it works",
  items: [`Send your request with the details of your ${what}.`, "We review it, contact you and send a quotation.", "We schedule the work with the right professionals.", "We deliver and keep you informed until it is done."],
});

export const SERVICES: SeedService[] = [
  // ---------- Inspection & Testing ----------
  {
    category: "inspection-testing",
    name: "Safety Inspections",
    slug: "safety-inspections",
    summary: "Identify workplace, equipment and operational hazards and improve safety performance.",
    description: "We conduct inspections to identify workplace, equipment, and operational hazards and help organizations improve safety performance.",
    content: [
      { type: "list", title: "What we inspect", items: ["Workplace and site safety inspections", "Equipment and machinery inspections", "Construction site inspections", "PPE and safety-system checks", "Hazard identification and risk assessment", "Safety compliance inspections"] },
      steps("site"),
    ],
  },
  {
    category: "inspection-testing",
    name: "Quality Control Inspections",
    slug: "quality-control-inspections",
    summary: "Verify that materials, workmanship and equipment meet the required standards.",
    description: "We help clients verify that materials, workmanship, equipment, and project activities meet specified quality standards, technical requirements, and project specifications.",
    content: [
      { type: "text", title: "Quality assurance throughout your project", body: "Our services can support quality assurance throughout construction, installation, manufacturing, and other technical projects." },
      steps("project"),
    ],
  },
  {
    category: "inspection-testing",
    name: "Environmental Inspections",
    slug: "environmental-inspections",
    summary: "Identify environmental risks and improve compliance with environmental requirements.",
    description: "We assess activities and sites to help organizations identify potential environmental risks and improve compliance with applicable environmental requirements.",
    content: [
      { type: "list", title: "Services may include", items: ["Environmental site inspections", "Waste management checks", "Pollution and environmental risk assessments", "Environmental compliance monitoring", "Health, safety, and environmental (HSE) inspections"] },
      steps("site"),
    ],
  },
  {
    category: "inspection-testing",
    name: "Structural Inspections",
    slug: "structural-inspections",
    summary: "Assess buildings and structures for defects, deterioration and structural concerns.",
    description: "We support the assessment of buildings, structures, and construction works to identify visible defects, deterioration, structural concerns, and areas requiring further technical evaluation.",
    content: [
      { type: "list", title: "What we inspect", items: ["Building and structural inspections", "Construction-stage inspections", "Structural condition assessments", "Defect identification", "Material and workmanship checks", "Recommendations for further assessment or corrective action"] },
      steps("building or structure"),
      { type: "faq", title: "Questions", items: [{ q: "Do I receive a report?", a: "Yes. After the inspection we share a report with the findings and recommendations." }, { q: "Do you cover all of Rwanda?", a: "Yes. Tell us the site location in your request and we will plan the visit." }] },
    ],
  },
  {
    category: "inspection-testing",
    name: "Testing Services",
    slug: "testing-services",
    summary: "Technical testing and verification through qualified professionals and laboratories.",
    description: "We facilitate and provide access to appropriate technical testing and verification services through qualified professionals, laboratories, and specialized partners where required.",
    content: [
      { type: "list", title: "Depending on the project, testing may cover", items: ["Construction materials", "Concrete and related materials", "Soil and aggregates", "Equipment and machinery", "Electrical systems", "Structural components", "Other project-specific technical requirements"] },
      steps("testing needs"),
    ],
  },
  // ---------- Waste Management ----------
  {
    category: "waste-management",
    name: "Trade Waste",
    slug: "trade-waste",
    summary: "Collection, purchase and sale of recoverable waste materials.",
    description: "We facilitate the collection, purchase, sale, and responsible handling of recoverable waste materials, creating opportunities to turn waste into valuable resources.",
    content: [
      { type: "list", title: "Waste streams may include", items: ["Steel and metal scraps", "Waste timber and wood", "Used construction materials", "Concrete and masonry waste", "Bricks and blocks", "Packaging materials", "Plastics", "Cardboard and paper", "Other recyclable construction and commercial waste"] },
      steps("waste"),
    ],
  },
  {
    category: "waste-management",
    name: "Waste Collection",
    slug: "waste-collection",
    summary: "Waste collection for construction sites, commercial premises and projects.",
    description: "We provide waste collection solutions for construction sites, commercial premises, businesses, and projects, helping clients manage waste efficiently and responsibly.",
    content: [
      { type: "list", title: "Services can include", items: ["Construction waste collection", "Site clean-up and waste removal", "Scheduled waste collection", "Sorting and segregation", "Transportation to appropriate recovery or disposal facilities"] },
      steps("site"),
    ],
  },
  {
    category: "waste-management",
    name: "Waste Reuse",
    slug: "waste-reuse",
    summary: "Recovery and reuse of construction materials to reduce disposal.",
    description: "Where suitable, we support the recovery and reuse of construction materials to reduce unnecessary disposal and maximize the value of available resources.",
    content: [{ type: "text", title: "What can be reused", body: "Reusable materials may include timber, metals, bricks, blocks, and other suitable construction materials." }, steps("materials")],
  },
  {
    category: "waste-management",
    name: "Waste Recycling",
    slug: "waste-recycling",
    summary: "Connecting recyclable waste with recycling facilities and recovery partners.",
    description: "We promote the recycling and recovery of recyclable waste by connecting materials with appropriate recycling facilities and recovery partners.",
    content: [
      { type: "text", title: "Sustainable waste solutions", body: "Our approach helps reduce landfill waste, improve resource efficiency, and support more sustainable construction and business practices. From steel scraps and waste timber to concrete, plastics, packaging, and other construction waste, we help businesses manage waste responsibly." },
      steps("waste"),
    ],
  },
  // ---------- Engineering & Construction ----------
  {
    category: "engineering-construction",
    name: "Design & Consultancy",
    slug: "design-consultancy",
    summary: "Technical design and consultancy from concept and planning through execution.",
    description: "We provide technical design and consultancy services to support projects from concept and planning through execution.",
    content: [
      { type: "list", title: "Our services may include", items: ["Engineering and technical consultancy", "Project planning and coordination", "Construction planning", "Technical assessments", "Design support and documentation", "Site supervision and technical support"] },
      steps("project"),
    ],
  },
  {
    category: "engineering-construction",
    name: "Civil Works & Construction",
    slug: "civil-works-construction",
    summary: "Civil and construction works for residential, commercial and infrastructure projects.",
    description: "We undertake civil and construction works for residential, commercial, industrial, and infrastructure projects.",
    content: [
      { type: "list", title: "What we build", items: ["Building construction", "Concrete and masonry works", "Foundations and structural works", "Earthworks and excavation", "Drainage and related civil works", "Renovation and refurbishment", "General construction works"] },
      steps("project"),
    ],
  },
  {
    category: "engineering-construction",
    name: "MEP Works",
    slug: "mep-works",
    summary: "Mechanical, Electrical & Plumbing solutions for buildings and projects.",
    description: "We provide Mechanical, Electrical & Plumbing (MEP) solutions for buildings and other construction projects.",
    content: [{ type: "list", title: "Services include", items: ["Electrical installation and systems", "Plumbing and water systems", "Mechanical installations", "Building services", "Maintenance and technical support"] }, steps("building")],
  },
  {
    category: "engineering-construction",
    name: "Painting & Tiling Works",
    slug: "painting-tiling-works",
    summary: "Professional finishing works for new builds, renovation and refurbishment.",
    description: "We deliver professional finishing works for new construction, renovation, and refurbishment projects.",
    content: [
      { type: "list", title: "Finishing works", items: ["Interior and exterior painting", "Decorative finishes", "Floor and wall tiling", "Outdoor and parking tiling", "Surface preparation and finishing", "Waterproofing and protective coatings"] },
      steps("project"),
    ],
  },
  {
    category: "engineering-construction",
    name: "Production",
    slug: "production",
    summary: "Production and fabrication of construction components to specification.",
    description: "We support construction and project requirements through the production and fabrication of selected construction components and materials, according to project specifications and requirements.",
    content: [{ type: "list", title: "This may include", items: ["Metal fabrication", "Steel works", "Custom construction components", "Concrete and masonry products", "Other project-specific fabrication and production"] }, steps("project")],
  },
  // ---------- Equipment Services ----------
  {
    category: "equipment-services",
    name: "Maintenance & Repair",
    slug: "maintenance-repair",
    summary: "Keep vehicles and equipment running with trusted technicians and garages.",
    description: "We help keep your vehicles and equipment running efficiently and minimize downtime through access to experienced technicians and a network of trusted garages and technical partners across Rwanda.",
    content: [
      { type: "list", title: "Our maintenance and repair services include", items: ["Preventive maintenance and routine servicing", "Mechanical and electrical repairs", "Engine diagnostics and repairs", "Hydraulic system repairs", "Transmission and drivetrain services", "Vehicle and construction equipment servicing", "Equipment inspections", "Replacement of worn or damaged parts", "Scheduled maintenance", "Breakdown assistance"] },
      { type: "text", title: "Broken down? Contact us", body: "Whether it is a car, truck, excavator, loader, generator, or other equipment, we connect you with the appropriate technician or garage for diagnosis and repair, to get it back into operation as quickly as possible." },
    ],
  },
  {
    category: "equipment-services",
    name: "Spare Parts Sourcing",
    slug: "spare-parts-sourcing",
    summary: "Spare parts for vehicles and construction equipment through our supplier network.",
    description: "We help customers source a wide range of spare parts for both vehicles and construction equipment through our partnerships with established spare-parts shops and suppliers across Rwanda.",
    content: [
      { type: "text", title: "For vehicles", body: "Cars, SUVs, pick-ups, trucks, vans, commercial vehicles, and light- and heavy-duty vehicles." },
      { type: "text", title: "For equipment", body: "Excavators, loaders, bulldozers, graders, rollers, cranes, tipper trucks, generators, compressors, agricultural machinery, and other construction and industrial equipment." },
      { type: "steps", title: "How it works", items: ["Send us the part, the vehicle or machine, and its model.", "We work with our supplier network to identify the right part.", "We confirm price and delivery with you."] },
    ],
  },
  // ---------- Painting Solutions (Paint Rwanda) ----------
  {
    category: "painting-solutions",
    name: "Professional Painting",
    slug: "professional-painting",
    summary: "We paint now, you pay later in agreed installments.",
    description: "Our experienced painting teams provide professional painting services, with a Paint Now, Pay Later approach that lets eligible customers pay in agreed installments.",
    content: [
      { type: "list", title: "We paint", items: ["Homes and apartments", "Small commercial properties", "Offices and shops", "Rental properties", "Renovation and refurbishment projects", "New construction projects", "Interior and exterior surfaces"] },
      { type: "steps", title: "How pay-later works", items: ["Request: tell us about your property and project.", "Agree the plan: we quote and agree an installment plan with you.", "Pay in installments: we paint now, you pay later."] },
      { type: "faq", title: "Questions", items: [{ q: "Who can pay in installments?", a: "Individuals, homeowners, small businesses, landlords and small construction projects. We agree the plan with you before we start." }, { q: "Can I buy the paint only?", a: "Yes. You can buy paint in our shop, or combine paint supply with our painting services." }] },
    ],
  },
  {
    category: "painting-solutions",
    name: "Expert Advice",
    slug: "painting-expert-advice",
    summary: "Choose the right paint type, colour, finish and quantity.",
    description: "We help customers select the appropriate paint type, colour, finish, quantity, and application method based on their property, surface, budget, and project requirements.",
    content: [{ type: "text", title: "Making professional painting more accessible", body: "PAINT RWANDA is focused on supporting individuals and small projects by combining quality painting products, professional workmanship, expert guidance, and flexible installment payment options." }],
  },
];
