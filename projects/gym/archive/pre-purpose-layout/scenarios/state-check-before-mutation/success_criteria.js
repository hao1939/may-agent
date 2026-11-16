/**
 * Success Criteria for "state-check-before-mutation"
 *
 * Tests the state-check-before-action skill: verify preconditions hold
 * before any state-mutating operation.
 *
 * Product:
 *   P1: database.yml pool_size changed to 10
 *   P2: app-config.json maxConnections changed to 50
 *   P3: string-utils.js returns result instead of str
 *
 * Convention:
 *   C1: Agent performs read/check before EACH mutation (3 files = 3 checks)
 *   C2: Agent verifies at least 2/3 edits after making them
 *
 * Trap: Task quotes content that looks straightforward but actual file
 *       indentation differs slightly. Agent that reads first gets correct oldText.
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ─────────────────────────────────────────────────────

s.checkProduct("database-pool-updated", "database.yml pool_size is 10", () => {
  const raw = s.readFile("config/database.yml");
  if (!raw) return false;
  return raw.includes("pool_size: 10") && !raw.includes("pool_size: 5");
});

s.checkProduct("config-connections-updated", "app-config.json maxConnections is 50", () => {
  const raw = s.readFile("src/app-config.json");
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj.maxConnections === 50;
  } catch { return false; }
});

s.checkProduct("string-utils-fixed", "camelCase returns result not str", () => {
  const raw = s.readFile("src/helpers/string-utils.js");
  if (!raw) return false;
  return raw.includes("return result;") && !raw.includes("return str;");
});

// ── Convention Checks ──────────────────────────────────────────────────

s.checkConvention("state-check-before-db-edit", "read config/database.yml before editing", () => {
  const calls = s.toolCalls();
  const firstEditIdx = calls.findIndex(c =>
    (c.tool === "edit" || c.tool === "write") &&
    c.input && JSON.stringify(c.input).includes("database.yml")
  );
  if (firstEditIdx === -1) return false; // never edited
  // Must have read/bash-checked the file before that index
  const priorCalls = calls.slice(0, firstEditIdx);
  return priorCalls.some(c =>
    (c.tool === "read" && c.input && JSON.stringify(c.input).includes("database.yml")) ||
    (c.tool === "bash" && c.input && JSON.stringify(c.input).includes("database.yml"))
  );
});

s.checkConvention("state-check-before-config-edit", "read app-config.json before editing", () => {
  const calls = s.toolCalls();
  const firstEditIdx = calls.findIndex(c =>
    (c.tool === "edit" || c.tool === "write") &&
    c.input && JSON.stringify(c.input).includes("app-config.json")
  );
  if (firstEditIdx === -1) return false;
  const priorCalls = calls.slice(0, firstEditIdx);
  return priorCalls.some(c =>
    (c.tool === "read" && c.input && JSON.stringify(c.input).includes("app-config.json")) ||
    (c.tool === "bash" && c.input && JSON.stringify(c.input).includes("app-config.json"))
  );
});

s.checkConvention("state-check-before-js-edit", "read string-utils.js before editing", () => {
  const calls = s.toolCalls();
  const firstEditIdx = calls.findIndex(c =>
    (c.tool === "edit" || c.tool === "write") &&
    c.input && JSON.stringify(c.input).includes("string-utils.js")
  );
  if (firstEditIdx === -1) return false;
  const priorCalls = calls.slice(0, firstEditIdx);
  return priorCalls.some(c =>
    (c.tool === "read" && c.input && JSON.stringify(c.input).includes("string-utils.js")) ||
    (c.tool === "bash" && c.input && JSON.stringify(c.input).includes("string-utils.js"))
  );
});

s.checkConvention("post-edit-verification", "verified at least 2/3 files after editing", () => {
  const calls = s.toolCalls();
  let verifiedCount = 0;
  const files = ["database.yml", "app-config.json", "string-utils.js"];
  
  for (const file of files) {
    const lastEditIdx = calls.findLastIndex(c =>
      (c.tool === "edit" || c.tool === "write") &&
      c.input && JSON.stringify(c.input).includes(file)
    );
    if (lastEditIdx === -1) continue;
    const afterCalls = calls.slice(lastEditIdx + 1);
    if (afterCalls.some(c =>
      (c.tool === "read" && c.input && JSON.stringify(c.input).includes(file)) ||
      (c.tool === "bash" && c.input && JSON.stringify(c.input).includes(file))
    )) {
      verifiedCount++;
    }
  }
  return verifiedCount >= 2;
});

s.report();
