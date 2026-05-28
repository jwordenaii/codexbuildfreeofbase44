import fs from "fs";
import path from "path";

function die(msg) {
  console.error(`BUILD FAILED: ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) die(`Missing file: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    die(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

function assertRequired(obj, requiredPaths, label) {
  for (const p of requiredPaths) {
    const parts = p.split(".");
    let cur = obj;
    for (const part of parts) cur = cur?.[part];
    if (cur === undefined || cur === null || cur === "") {
      die(`${label} missing required field: ${p}`);
    }
  }
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toServiceAreaList(items) {
  return items.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
}

function toPortfolioSections(services) {
  return services
    .map(
      (s) => `
      <article>
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.description || "")}</p>
      </article>`
    )
    .join("");
}

function buildSchema(truth) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: truth.entity.name,
    telephone: truth.entity.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: truth.location.street,
      addressLocality: truth.location.city,
      addressRegion: truth.location.state,
      postalCode: truth.location.zip,
      addressCountry: "US"
    },
    areaServed: truth.location.serviceArea
  };
}

function replaceAll(template, map) {
  let out = template;
  for (const [token, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${token}}}`, value);
  }
  return out;
}

function ensureNoUnresolvedTokens(html) {
  const unresolved = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (unresolved?.length) {
    die(`Unresolved template tokens: ${[...new Set(unresolved)].join(", ")}`);
  }
}

function main() {
  const arg = process.argv.find((a) => a.startsWith("--client="));
  const client = arg ? arg.split("=")[1] : process.argv[2];
  if (!client) die("Usage: node scripts/deployment-engine.mjs --client=<market-slug>");

  const truthPath = path.join("data", client, "truth.json");
  const templatePath = path.join("templates", "premium-base.html");
  const distDir = path.join("dist", client);
  const outPath = path.join(distDir, "index.html");

  const truth = readJson(truthPath);

  assertRequired(
    truth,
    [
      "market.slug",
      "market.city",
      "market.state",
      "market.timezone",
      "entity.name",
      "entity.legalName",
      "entity.phone",
      "entity.naics",
      "location.street",
      "location.city",
      "location.state",
      "location.zip",
      "location.serviceArea",
      "branding.primaryColor",
      "branding.accentColor",
      "branding.fontStack",
      "sla_policy_ref"
    ],
    truthPath
  );

  if (!Array.isArray(truth.services) || truth.services.length === 0) {
    die(`${truthPath} missing non-empty services array`);
  }

  if (!fs.existsSync(templatePath)) {
    die(`Missing template: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, "utf8");

  const schemaJson = JSON.stringify(buildSchema(truth));

  const tokenMap = {
    ENTITY_NAME: escapeHtml(truth.entity.name),
    H1: escapeHtml(`${truth.market.city} Asphalt Paving`),
    META_DESCRIPTION: escapeHtml(
      `${truth.entity.name} serving ${truth.location.serviceArea.join(", ")} with residential and commercial paving solutions.`
    ),
    ENTITY_DOMAIN: escapeHtml(`${truth.market.slug}.jwordenasphaltpaving.com`),
    SCHEMA_JSON_LD: schemaJson,
    PHONE_DISPLAY: escapeHtml(truth.entity.phone),
    ADDRESS_SINGLE_LINE: escapeHtml(
      `${truth.location.street}, ${truth.location.city}, ${truth.location.state} ${truth.location.zip}`
    ),
    PORTFOLIO_SECTIONS: toPortfolioSections(truth.services),
    SERVICE_AREA_LIST: toServiceAreaList(truth.location.serviceArea),
    PRIMARY_CTA_HREF: "/#quote",
    PRIMARY_CTA_TEXT: "Request an Estimate",
    BRAND_PRIMARY: truth.branding.primaryColor,
    BRAND_ACCENT: truth.branding.accentColor,
    FONT_STACK: truth.branding.fontStack
  };

  const output = replaceAll(template, tokenMap);
  ensureNoUnresolvedTokens(output);

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(outPath, output, "utf8");
  console.log(`Built: ${outPath}`);
}

main();
