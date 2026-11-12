const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const schemaBytes = fs.readFileSync(path.join(root, "config", "schema.json"));
const schema = JSON.parse(schemaBytes.toString("utf8"));
const schemaSha256 = crypto.createHash("sha256").update(schemaBytes).digest("hex");

const lockPath = path.join(root, "state", "schema-lock.json");
fs.mkdirSync(path.dirname(lockPath), { recursive: true });
fs.writeFileSync(
  lockPath,
  JSON.stringify(
    {
      schemaVersion: schema.schemaVersion,
      source: schema.source,
      schemaSha256,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Provisioned ${lockPath} (${schemaSha256})`);
