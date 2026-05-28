import fs from "fs";
import path from "path";

const [, , slug, city, state] = process.argv;

if (!slug || !city || !state) {
  console.error("Usage: node scripts/generate-city-pack.mjs <slug> <city> <state>");
  process.exit(1);
}

const dir = path.join("data", slug);
fs.mkdirSync(dir, { recursive: true });

const truth = {
  market: {
    slug,
    city,
    state,
    timezone: "America/New_York"
  },
  entity: {
    name: "J. Worden & Sons Asphalt Paving",
    legalName: "J. Worden & Sons Paving, LLC",
    phone: "(804) 446-1296",
    naics: "237310"
  },
  location: {
    street: "1601 Ware Bottom Spring Rd, Suite 214",
    city: "Chester",
    state: "VA",
    zip: "23836",
    serviceArea: [city]
  },
  services: [
    {
      slug: "residential-quote",
      name: "Residential Paving",
      ctaPath: "/thanks-residential-quote"
    },
    {
      slug: "commercial-maintenance",
      name: "Commercial Maintenance",
      ctaPath: "/thanks-commercial-maintenance"
    }
  ],
  branding: {
    primaryColor: "#004a99",
    accentColor: "#ffcc00",
    fontStack: "'Helvetica Neue', Arial, sans-serif"
  },
  sla_policy_ref: "config/sla-policy.json"
};

fs.writeFileSync(path.join(dir, "truth.json"), JSON.stringify(truth, null, 2));
console.log(`Created ${path.join(dir, "truth.json")}`);
