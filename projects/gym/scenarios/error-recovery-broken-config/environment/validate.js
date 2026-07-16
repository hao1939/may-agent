#!/usr/bin/env node
// Validation script — checks config.json is valid and has required fields
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");

try {
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw);

  const required = ["appName", "version", "database", "cache", "logging", "features", "timeout"];
  const missing = required.filter(k => !(k in config));

  if (missing.length > 0) {
    console.error("FAIL: Missing required fields:", missing.join(", "));
    process.exit(1);
  }

  // Check nested required fields
  if (!config.database.host || !config.database.port) {
    console.error("FAIL: database.host and database.port are required");
    process.exit(1);
  }

  if (typeof config.timeout !== "number" || config.timeout < 1000) {
    console.error("FAIL: timeout must be a number >= 1000");
    process.exit(1);
  }

  console.log("OK: Config is valid. All required fields present.");
  process.exit(0);
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
