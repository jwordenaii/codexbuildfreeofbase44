import fs from "fs";

const templatePath = "templates/premium-base.html";

const requiredTokens = [
  "ENTITY_NAME",
  "H1",
  "META_DESCRIPTION",
  "ENTITY_DOMAIN",
  "SCHEMA_JSON_LD",
  "PHONE_DISPLAY",
  "ADDRESS_SINGLE_LINE",
  "PORTFOLIO_SECTIONS",
  "SERVICE_AREA_LIST",
  "PRIMARY_CTA_HREF",
  "PRIMARY_CTA_TEXT",
  "BRAND_PRIMARY",
  "BRAND_ACCENT",
  "FONT_STACK"
];

function die(msg) {
  console.error(`CONTRACT CHECK FAILED: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(templatePath)) {
  die(`Missing template: ${templatePath}`);
}

const html = fs.readFileSync(templatePath, "utf8");
const missing = requiredTokens.filter((t) => !html.includes(`{{${t}}}`));
if (missing.length) {
  die(`Missing required tokens: ${missing.map((m) => `{{${m}}}`).join(", ")}`);
}

const tokenMatches = html.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || [];
const invalidStyle = tokenMatches.filter((tok) => !/^\{\{[A-Z0-9_]+\}\}$/.test(tok));
if (invalidStyle.length) {
  die(`Invalid token style (must be UPPER_SNAKE): ${[...new Set(invalidStyle)].join(", ")}`);
}

const usedNames = [...new Set(tokenMatches.map((t) => t.slice(2, -2)))];
const unknown = usedNames.filter((n) => !requiredTokens.includes(n));
if (unknown.length) {
  console.warn(`WARN: Extra tokens found (ensure tokenMap supports them): ${unknown.join(", ")}`);
}

console.log("Template contract check passed.");
