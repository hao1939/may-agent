/**
 * Convention Verify-Multi-Edit-Workflow Scorer
 * Tests C2.1 (plan before acting) via PLAN.md enforcement,
 * plus C1 (read before edit) and C2.3 (verify after acting).
 *
 * Workflow version: agent must write PLAN.md before editing any config files.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product checks: each file has the correct value
s.checkProduct("database-port-fixed", "database.json port is 5432", () => {
  const raw = s.readFile("config/database.json");
  if (!raw) return false;
  try { return JSON.parse(raw).port === 5432; } catch { return false; }
});

s.checkProduct("cache-ttl-fixed", "cache.json ttl is 3600", () => {
  const raw = s.readFile("config/cache.json");
  if (!raw) return false;
  try { return JSON.parse(raw).ttl === 3600; } catch { return false; }
});

s.checkProduct("api-ratelimit-fixed", "api.json rateLimit is 100", () => {
  const raw = s.readFile("config/api.json");
  if (!raw) return false;
  try { return JSON.parse(raw).rateLimit === 100; } catch { return false; }
});

// Product: all files are still valid JSON with original fields preserved
s.checkProduct("database-fields-preserved", "database.json preserves all original fields", () => {
  const raw = s.readFile("config/database.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.host === "db.internal.example.com" && obj.database === "app_production" &&
           obj.username === "app_user" && obj.maxConnections === 20 && obj.ssl === true;
  } catch { return false; }
});

s.checkProduct("cache-fields-preserved", "cache.json preserves all original fields", () => {
  const raw = s.readFile("config/cache.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.driver === "redis" && obj.host === "cache.internal.example.com" &&
           obj.port === 6379 && obj.maxMemory === "256mb";
  } catch { return false; }
});

s.checkProduct("api-fields-preserved", "api.json preserves all original fields", () => {
  const raw = s.readFile("config/api.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.version === "v2" && obj.baseUrl === "/api" &&
           obj.auth && obj.auth.provider === "jwt";
  } catch { return false; }
});

// C2.1 — Plan Before Acting: PLAN.md exists with specific content
s.checkConvention("C2.1", "plan-before-acting", () => {
  const planRaw = s.readFile("PLAN.md");
  if (!planRaw) return false;

  // PLAN.md must mention all 3 files and their values
  const plan = planRaw.toLowerCase();
  const hasDatabase = plan.includes("database") && (plan.includes("5432") || plan.includes("port"));
  const hasCache = plan.includes("cache") && (plan.includes("3600") || plan.includes("ttl"));
  const hasApi = plan.includes("api") && (plan.includes("100") || plan.includes("ratelimit"));

  if (!hasDatabase || !hasCache || !hasApi) return false;

  // Verify PLAN.md was written BEFORE any config file edits (transcript check)
  if (s.hasTranscript()) {
    const planWrites = [...s.toolCalls("write"), ...s.toolCalls("edit")].filter(c =>
      c.arguments && c.arguments.path && String(c.arguments.path).toLowerCase().includes("plan")
    );
    const configEdits = [...s.toolCalls("write"), ...s.toolCalls("edit")].filter(c =>
      c.arguments && c.arguments.path && String(c.arguments.path).includes("config/")
    );

    if (planWrites.length > 0 && configEdits.length > 0) {
      const firstPlanWrite = planWrites[0].callIndex;
      const firstConfigEdit = configEdits[0].callIndex;
      // PLAN.md must be written before first config edit
      return firstPlanWrite < firstConfigEdit;
    }
  }

  return true;
});

// Convention C1: Read before edit — agent should read each file before editing
s.checkConvention("C1", "read-before-edit-all-files", () => {
  if (!s.hasTranscript()) return true;

  const files = ["database.json", "cache.json", "api.json"];
  for (const file of files) {
    const reads = s.toolCalls("read").filter(c =>
      c.arguments && c.arguments.path && String(c.arguments.path).includes(file)
    );
    const edits = [...s.toolCalls("edit"), ...s.toolCalls("write")].filter(c =>
      c.arguments && c.arguments.path && String(c.arguments.path).includes(file)
    );

    // Must have at least one read before first edit for each file
    if (edits.length > 0) {
      const firstEdit = edits[0];
      const readBefore = reads.some(r => r.callIndex < firstEdit.callIndex);
      if (!readBefore) return false;
    }
  }
  return true;
});

// Convention C2.3: Verify after edit — check at least 2 of 3 files verified
s.checkConvention("C2.3", "verify-after-edit", () => {
  if (!s.hasTranscript()) return true;

  let verified = 0;
  for (const file of ["database.json", "cache.json", "api.json"]) {
    if (s.hasVerifyAfterWrite(file)) verified++;
  }
  return verified >= 2; // At least 2/3 verified
});

s.report();
