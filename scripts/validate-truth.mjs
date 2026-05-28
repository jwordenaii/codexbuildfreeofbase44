import fs from "fs";
import path from "path";
import Ajv2020 from "ajv/dist/2020.js";

const schemaPath = "schemas/truth.schema.json";
const dataRoot = "data";

if (!fs.existsSync(schemaPath)) {
  console.error(`Missing schema: ${schemaPath}`);
  process.exit(1);
}

if (!fs.existsSync(dataRoot)) {
  console.error(`Missing data directory: ${dataRoot}`);
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const markets = fs
  .readdirSync(dataRoot)
  .filter((d) => fs.existsSync(path.join(dataRoot, d, "truth.json")));

if (!markets.length) {
  console.error("No market truth.json files found under data/*/truth.json");
  process.exit(1);
}

let failed = false;
for (const market of markets) {
  const p = path.join(dataRoot, market, "truth.json");
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  const ok = validate(json);
  if (!ok) {
    failed = true;
    console.error(`\n[FAIL] ${p}`);
    for (const e of validate.errors || []) {
      console.error(` - ${e.instancePath || "/"} ${e.message}`);
    }
  } else {
    console.log(`[PASS] ${p}`);
  }
}

if (failed) process.exit(1);
console.log(`\nValidated ${markets.length} market truth.json file(s).`);
