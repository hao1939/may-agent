/**
 * Success Criteria for "context-proof-config"
 *
 * Tests whether context learning helps the agent find the config file faster.
 *
 * Phase 1: Agent searches for database config, finds it at config/database.json,
 *   updates timeout from 3000 to 5000.
 *   Context learner should extract: "database config is at config/database.json"
 *
 * Phase 2: Agent updates maxRetries from 3 to 5 in the same config.
 *   WITH context: should go straight to config/database.json
 *   WITHOUT context: may search around (src/, package.json, etc.) first
 *
 * Key metric: number of read/bash operations before the edit in phase 2.
 *
 * Product:
 *   P1: phase1-report.md exists
 *   P2: phase2-report.md exists
 *   P3: config/database.json has timeout: 5000
 *   P4: config/database.json has maxRetries: 5
 *   P5: Other config fields unchanged
 *
 * Behavior:
 *   B1: Phase 2 edits config/database.json (correct file)
 *
 * Efficiency:
 *   E1: Phase 2 total ops ≤ 10
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("phase1-report", "phase1-report.md exists", () => {
  return s.fileExists("phase1-report.md");
});

s.checkProduct("phase2-report", "phase2-report.md exists", () => {
  return s.fileExists("phase2-report.md");
});

s.checkProduct("timeout-updated", "config/database.json has timeout: 5000", () => {
  const raw = s.readFile("config/database.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return config.timeout === 5000;
  } catch { return false; }
});

s.checkProduct("retries-updated", "config/database.json has maxRetries: 5", () => {
  const raw = s.readFile("config/database.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return config.maxRetries === 5;
  } catch { return false; }
});

s.checkProduct("other-fields-intact", "Other config fields unchanged", () => {
  const raw = s.readFile("config/database.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return config.host === "localhost" &&
           config.port === 5432 &&
           config.database === "myapp" &&
           config.poolSize === 10 &&
           config.ssl === false;
  } catch { return false; }
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("edits-correct-file", "Phase 2 edits config/database.json", () => {
  if (!s.hasTranscript()) return false;
  // Check for write/edit to the correct file
  const writes = s.toolCalls("write").concat(s.toolCalls("edit"));
  return writes.some(tc => {
    const p = String((tc.arguments || {}).path || "");
    return p.includes("config/database.json");
  });
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("phase2-efficient", "Phase 2 total ops ≤ 10", () => {
  return s.ops() <= 10;
});

s.report();
