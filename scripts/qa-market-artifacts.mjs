import fs from "fs";
import path from "path";

function fail(msg) {
  console.error(`QA FAIL: ${msg}`);
  process.exitCode = 1;
}

function getMarkets() {
  const root = "data";
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((slug) => fs.existsSync(path.join(root, slug, "truth.json")))
    .sort();
}

function extractJsonLd(html) {
  const m = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  return m ? m[1].trim() : null;
}

function qaMarket(slug) {
  const truthPath = path.join("data", slug, "truth.json");
  const htmlPath = path.join("dist", slug, "index.html");

  if (!fs.existsSync(truthPath)) return fail(`[${slug}] missing truth.json`);
  if (!fs.existsSync(htmlPath)) return fail(`[${slug}] missing dist index.html`);

  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const html = fs.readFileSync(htmlPath, "utf8");

  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) fail(`[${slug}] unresolved template tokens`);

  const jsonLdRaw = extractJsonLd(html);
  if (!jsonLdRaw) return fail(`[${slug}] missing JSON-LD block`);

  let jsonLd;
  try {
    jsonLd = JSON.parse(jsonLdRaw);
  } catch {
    return fail(`[${slug}] invalid JSON-LD JSON`);
  }

  for (const key of ["@type", "name", "telephone", "address"]) {
    if (!jsonLd[key]) fail(`[${slug}] JSON-LD missing ${key}`);
  }

  const napValues = [
    truth.entity?.phone,
    truth.location?.street,
    truth.location?.city,
    truth.location?.state,
    truth.location?.zip
  ];

  for (const v of napValues) {
    if (!v) {
      fail(`[${slug}] truth.json missing NAP field`);
      continue;
    }
    if (!html.includes(String(v))) fail(`[${slug}] HTML missing NAP value: ${v}`);
  }

  console.log(`QA PASS: ${slug}`);
}

const markets = getMarkets();
if (!markets.length) {
  console.error("QA FAIL: no markets found under data/*/truth.json");
  process.exit(1);
}

for (const slug of markets) qaMarket(slug);

if (process.exitCode) process.exit(process.exitCode);
console.log(`QA complete. ${markets.length} market(s) checked.`);
