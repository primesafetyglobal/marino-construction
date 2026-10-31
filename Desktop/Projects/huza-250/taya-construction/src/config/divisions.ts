// DIVISIONS: the 8 business divisions (D-10). CLIENT-SAFE.
// Names follow docs/spec/01-project-details.md; taglines and sub-services
// follow the client's text (docs/client/divisions-overview.md).
//
// `enum` is the Prisma Division value; `variant` picks the division page layout.

export type DivisionEnum =
  | "EQUIPMENT"
  | "TRAINING"
  | "INSPECTION_TESTING"
  | "MATERIALS"
  | "WASTE_MANAGEMENT"
  | "WORKFORCE"
  | "ENGINEERING"
  | "PAINT_RWANDA";

export type DivisionVariant = "equipment" | "training" | "services" | "materials" | "workforce" | "paint";

export type Division = {
  number: number;
  enum: DivisionEnum;
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  subServices: string[];
  icon: "Truck" | "GraduationCap" | "SearchCheck" | "BrickWall" | "Recycle" | "HardHat" | "Building2" | "PaintRoller";
  variant: DivisionVariant;
  heading: string;
  intro: string;
  why: string[];
};

export const DIVISIONS: readonly Division[] = [
  {
    number: 1,
    enum: "EQUIPMENT",
    slug: "equipment",
    name: "Equipment",
    shortName: "Equipment",
    tagline: "Rent • Buy • Trade • Spare Parts • Maintenance",
    subServices: ["Rent", "Buy", "Trade", "Spare Parts", "Maintenance"],
    icon: "Truck",
    variant: "equipment",
    heading: "One Place for All Your Equipment & Automotive Needs",
    intro:
      "From renting a machine or car to purchasing equipment, selling or renting out your own machinery, sourcing spare parts, or arranging maintenance and repairs, we connect customers with equipment owners, suppliers, technicians, and garages through one convenient service.",
    why: [
      "Reliable equipment and automotive solutions across Rwanda for individuals, contractors, companies and organizations.",
      "Flexible daily, weekly, monthly and project-based rental options.",
      "A trusted network of equipment owners, suppliers, technicians and garages.",
    ],
  },
  {
    number: 2,
    enum: "TRAINING",
    slug: "training",
    name: "Safety & Training",
    shortName: "Training",
    tagline: "HSE • Construction • Certifications • Accredited Training",
    subServices: ["HSE Trainings", "Construction Trainings", "Certificates", "Accreditation & Partners"],
    icon: "GraduationCap",
    variant: "training",
    heading: "Building Safer Workplaces Through Skills & Competence",
    intro:
      "We provide professional Safety, Health & Environment (HSE) and Construction Training Services for companies, contractors, workers, supervisors, and professionals.",
    why: [
      "Practical training tailored to organizations, construction sites, projects and individuals.",
      "Certificates of completion, and accredited certification with authorized partners where required.",
      "Courses are delivered and certified by Prime Safety Global.",
    ],
  },
  {
    number: 3,
    enum: "INSPECTION_TESTING",
    slug: "inspection-testing",
    name: "Inspection & Testing",
    shortName: "Inspection",
    tagline: "Safety • Quality • Environmental • Structural • Testing",
    subServices: ["Safety Inspections", "Quality Control", "Environmental", "Structural", "Testing Services"],
    icon: "SearchCheck",
    variant: "services",
    heading: "Professional Inspection, Compliance & Testing Solutions",
    intro:
      "We help businesses, contractors, project owners, and organizations identify risks, verify quality, ensure compliance, and maintain safe and reliable operations.",
    why: [
      "Safety, quality, environmental, structural and technical inspections.",
      "Qualified professionals and appropriate testing methods.",
      "Access to laboratories and specialized partners where required.",
    ],
  },
  {
    number: 4,
    enum: "MATERIALS",
    slug: "materials",
    name: "Materials",
    shortName: "Materials",
    tagline: "Construction Materials • Paint • Tiles • Waterproofing • Chemicals",
    subServices: ["Aggregates", "Concrete & Bricks", "Paints", "Tiles", "Waterproofing", "Chemicals"],
    icon: "BrickWall",
    variant: "materials",
    heading: "Quality Materials for Construction & Finishing",
    intro:
      "We supply a comprehensive range of construction materials, finishing products, waterproofing solutions, and construction chemicals for residential, commercial, industrial, and infrastructure projects.",
    why: [
      "From foundation and structural works to finishing, protection and maintenance.",
      "Reliable sourcing and solutions tailored to project requirements.",
      "Bulk and project-based supply with a quotation and product consultation.",
    ],
  },
  {
    number: 5,
    enum: "WASTE_MANAGEMENT",
    slug: "waste-management",
    name: "Waste Management",
    shortName: "Waste",
    tagline: "Waste Collection • Reuse • Recycling • Waste Trading",
    subServices: ["Trade Waste", "Waste Collection", "Waste Reuse", "Waste Recycling"],
    icon: "Recycle",
    variant: "services",
    heading: "Responsible Waste Management & Resource Recovery",
    intro:
      "We provide practical waste management and environmental services for construction companies, businesses, contractors, industries, and organizations.",
    why: [
      "Responsible collection, handling, reuse, recycling and recovery of waste.",
      "Clean sites and sustainable resource management.",
      "Turn steel, timber, concrete, plastics and packaging into value.",
    ],
  },
  {
    number: 6,
    enum: "WORKFORCE",
    slug: "workforce",
    name: "Workforce",
    shortName: "Workforce",
    tagline: "Skilled Workers • Operators • Professionals • Manpower",
    subServices: ["Manpower", "Skilled Workers", "Equipment Operators", "Technical Professionals"],
    icon: "HardHat",
    variant: "workforce",
    heading: "Reliable People for Construction & Technical Projects",
    intro:
      "We provide qualified manpower, skilled workers, equipment operators, and technical professionals to support construction projects, businesses, contractors, and organizations across Rwanda.",
    why: [
      "Short-term assignments, project-based work and longer-term staffing.",
      "From a single skilled worker to a complete project workforce.",
      "Personnel matched on skills, experience and project scope.",
    ],
  },
  {
    number: 7,
    enum: "ENGINEERING",
    slug: "engineering",
    name: "Engineering & Construction",
    shortName: "Engineering",
    tagline: "Design • Consultancy • Civil • MEP • Painting • Tiling • Production",
    subServices: ["Design & Consultancy", "Civil Works", "MEP Works", "Painting & Tiling", "Production"],
    icon: "Building2",
    variant: "services",
    heading: "Integrated Engineering, Construction & Project Solutions",
    intro:
      "We provide integrated engineering and construction services for residential, commercial, industrial, and infrastructure projects.",
    why: [
      "Technical expertise, skilled workforce, quality materials and project coordination.",
      "From design and consultancy to construction, finishing, MEP and production.",
      "One reliable service provider for your whole project.",
    ],
  },
  {
    number: 8,
    enum: "PAINT_RWANDA",
    slug: "paint-rwanda",
    name: "Paint Rwanda",
    shortName: "Paint Rwanda",
    tagline: "Paint Sales • Painting Services • Flexible Payment",
    subServices: ["We Paint. You Pay Later!", "Flexible Payment", "Quality Paint", "Painting Services", "Expert Advice"],
    icon: "PaintRoller",
    variant: "paint",
    heading: "We Paint. You Pay Later!",
    intro:
      "PAINT RWANDA is a flexible painting solution designed to make professional painting services more accessible to individuals, homeowners, small businesses, landlords, and small construction projects.",
    why: [
      "Pay in agreed installments with our Paint Now, Pay Later approach.",
      "Quality paints, coatings, primers and finishing products.",
      "Expert advice on paint type, colour, finish, quantity and application.",
    ],
  },
];

export function divisionBySlug(slug: string): Division | undefined {
  return DIVISIONS.find((d) => d.slug === slug);
}

export function divisionByEnum(value: DivisionEnum | string | null | undefined): Division | undefined {
  return DIVISIONS.find((d) => d.enum === value);
}

export const DIVISION_ENUMS = DIVISIONS.map((d) => d.enum) as [DivisionEnum, ...DivisionEnum[]];
