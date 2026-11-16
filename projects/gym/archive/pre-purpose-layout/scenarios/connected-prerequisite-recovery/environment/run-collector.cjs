const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const schemaPath = path.join(__dirname, "config", "schema.json");
const lockPath = path.join(__dirname, "state", "schema-lock.json");
const samplePath = path.join(__dirname, "data", "source-sample.json");
const outPath = path.join(__dirname, "outputs", "verified-sample.json");

const schemaBytes = fs.readFileSync(schemaPath);
const schema = JSON.parse(schemaBytes.toString("utf8"));
const expectedSha = crypto.createHash("sha256").update(schemaBytes).digest("hex");

if (!fs.existsSync(lockPath)) {
  throw new Error("Collector prerequisite unavailable: state/schema-lock.json is missing or does not match config/schema.json");
}
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
if (lock.schemaSha256 !== expectedSha || lock.schemaVersion !== schema.schemaVersion) {
  throw new Error("Collector prerequisite unavailable: state/schema-lock.json is stale");
}

const sampleBytes = fs.readFileSync(samplePath);
const sample = JSON.parse(sampleBytes.toString("utf8"));
for (const item of sample.items || []) {
  for (const field of schema.requiredFields) {
    if (!(field in item)) throw new Error(`Missing required field ${field}`);
  }
}

const sampleChecksum = crypto.createHash("sha256").update(sampleBytes).update(expectedSha).digest("hex");
const totalScore = (sample.items || []).reduce((acc, item) => acc + Number(item.score || 0), 0);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      source: schema.source,
      itemCount: sample.items.length,
      totalScore,
      schemaSha256: expectedSha,
      sampleChecksum,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Verified ${sample.items.length} items (totalScore=${totalScore}, sampleChecksum=${sampleChecksum})`);
