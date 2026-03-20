/**
 * Convention Verify-Multi-Edit Workflow Scorer
 * Same checks as baseline, so results are directly comparable.
 * The workflow splits task into Phase 1 (edit) and Phase 2 (verify),
 * which mechanically ensures verification happens.
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

// Convention C1: Read before edit — agent should read each file before editing
s.checkConvention("C1", "read-before-edit-all-files", () => {
  if (!s.hasTranscript()) return true;

  const files = ["database.json", "cache.json", "api.json"];
  for (const file of files) {
    const reads = s.toolCalls("read").filter(c =>
      c.arguments.path && String(c.arguments.path).includes(file)
    );
    const edits = [...s.toolCalls("edit"), ...s.toolCalls("write")].filter(c =>
      c.arguments.path && String(c.arguments.path).includes(file)
    );

    // Must have at least one read before first edit for each file
    if (edits.length > 0) {
      const firstEdit = edits[0];
      const readBefore = reads.some(r => r.entryIndex < firstEdit.entryIndex);
      if (!readBefore) return false;
    }
  }
  return true;
});

// Convention C2.3: Verify after edit — check at least 2 of 3 files verified
// In workflow mode, Phase 2 is a separate session that only has reads (writes were in Phase 1).
// The gym runner exports only the last session's transcript, so hasVerifyAfterWrite won't find writes.
// Instead, check that Phase 2 reads at least 2 of the 3 files (which IS the verification).
s.checkConvention("C2.3", "verify-after-edit", () => {
  if (!s.hasTranscript()) return true;

  // First try the standard check (works if transcript combines both phases)
  let verified = 0;
  for (const file of ["database.json", "cache.json", "api.json"]) {
    if (s.hasVerifyAfterWrite(file)) verified++;
  }
  if (verified >= 2) return true;

  // Workflow fallback: if no writes visible (Phase 2 only transcript),
  // check that at least 2 files were read (Phase 2's job is verification)
  let filesRead = 0;
  for (const file of ["database.json", "cache.json", "api.json"]) {
    const reads = s.toolCalls("read").filter(c =>
      c.arguments.path && String(c.arguments.path).includes(file)
    );
    if (reads.length > 0) filesRead++;
  }
  return filesRead >= 2;
});

s.report();
