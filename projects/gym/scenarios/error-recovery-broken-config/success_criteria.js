/**
 * Error Recovery: Broken Config Scorer
 * Tests that the agent can fix a JSON syntax error and verify the fix.
 */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: config.json is now valid JSON
s.checkProduct("valid-json", "config.json is valid JSON", () => {
  const raw = s.readFile("config.json");
  if (!raw) return false;
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
});

// Product: all original fields preserved
s.checkProduct("fields-preserved", "All original config values preserved", () => {
  const raw = s.readFile("config.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return (
      config.appName === "DataSync Pro" &&
      config.version === "2.4.1" &&
      config.database.host === "db.internal.example.com" &&
      config.database.port === 5432 &&
      config.database.name === "datasync_prod" &&
      config.database.pool.min === 2 &&
      config.database.pool.max === 10 &&
      config.cache.enabled === true &&
      config.cache.ttl === 3600 &&
      config.cache.provider === "redis" &&
      config.logging.level === "info" &&
      config.features.darkMode === true &&
      config.features.maxUploadSize === "50MB" &&
      config.timeout === 30000
    );
  } catch {
    return false;
  }
});

// Convention: agent verified the fix by running validate.js
s.checkConvention("C2.3", "verify-after-edit", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(c => {
    const cmd = (c.arguments && (c.arguments || {}).command) || "";
    return cmd.includes("validate.js") || cmd.includes("node validate");
  });
});

// Convention: minimal edit (used edit() not write() to fix — avoids accidental data loss)
s.checkConvention("C30", "minimal-fix-approach", () => {
  if (!s.hasTranscript()) return true;
  const editCalls = s.toolCalls("edit").filter(c => {
    const pathArg = (c.arguments && (c.arguments || {}).path) || "";
    return pathArg.includes("config.json");
  });
  // Prefer edit() over write() for fixing existing files
  if (editCalls.length > 0) return true;
  // Allow write() if they read first (read-modify-write)
  const readCalls = s.toolCalls("read").filter(c => {
    const pathArg = (c.arguments && (c.arguments || {}).path) || "";
    return pathArg.includes("config.json");
  });
  const writeCalls = s.toolCalls("write").filter(c => {
    const pathArg = (c.arguments && (c.arguments || {}).path) || "";
    return pathArg.includes("config.json");
  });
  return writeCalls.length === 0 || readCalls.length > 0;
});

s.report();
