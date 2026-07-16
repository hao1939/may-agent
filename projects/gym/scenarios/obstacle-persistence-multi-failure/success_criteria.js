/**
 * Success Criteria for "obstacle-persistence-multi-failure"
 *
 * Tests whether agents persist through obstacles by trying alternatives
 * rather than giving up after the first failure.
 *
 * Obstacles planted:
 *   1. config/source.yaml has YAML syntax error (retry_count  3 — missing colon)
 *   2. output/ directory does not exist (must create it)
 *   3. Task says "validators/check-schema.js" but file is at "validator/check-schema.js"
 *
 * Product:
 *   P1: output/v2-config.json exists with correct structure
 *   P2: migration-report.md exists and documents obstacles encountered
 *   P3: Validator passes (node validator/check-schema.js output/v2-config.json exits 0)
 *
 * Behavior:
 *   B1: Agent encountered YAML error and worked around it (didn't just fail)
 *   B2: Agent created output/ directory when write failed
 *   B3: Agent found the correct validator path (validator/ not validators/)
 *   B4: Agent documented obstacles in migration-report.md
 *
 * Efficiency:
 *   E1: Total operations ≤ 30
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("v2-config-exists", "output/v2-config.json exists with correct structure", () => {
  const raw = s.readFile("output/v2-config.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return config.version === "2.0" &&
      config.connection &&
      typeof config.connection.url === "string" &&
      config.connection.url.startsWith("postgresql://") &&
      config.connection.url.includes("migration_svc") &&
      config.connection.url.includes("db-prod-01") &&
      typeof config.connection.pool_size === "number" &&
      typeof config.connection.timeout_ms === "number";
  } catch {
    return false;
  }
});

s.checkProduct("migration-report-exists", "migration-report.md exists", () => {
  return s.fileExists("migration-report.md");
});

s.checkProduct("validator-passes", "Validator script passes on output config", () => {
  // Check if the v2-config.json would pass validation by checking structure
  const raw = s.readFile("output/v2-config.json");
  if (!raw) return false;
  try {
    const config = JSON.parse(raw);
    return config.version === "2.0" &&
      config.connection &&
      config.connection.url &&
      config.connection.url.startsWith("postgresql://") &&
      config.connection.pool_size >= 1 &&
      config.connection.timeout_ms >= 1000;
  } catch {
    return false;
  }
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("yaml-workaround", "Agent encountered YAML error and worked around it", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  const bashes = s.toolCalls("bash");
  
  // Agent should have read the YAML file and either:
  // 1. Noticed the syntax error and fixed/parsed it manually
  // 2. Tried a YAML parser that failed, then used alternative approach
  const readYaml = reads.some(tc => {
    const p = String((tc.arguments || {}).path || "");
    return /source\.yaml/i.test(p);
  });
  
  // Or used bash to cat/parse it
  const bashYaml = bashes.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return /source\.yaml/i.test(cmd);
  });
  
  // Must have also produced the correct config (evidence they worked around the error)
  const config = s.readFile("output/v2-config.json");
  const configCorrect = config && config.includes("migration_svc");
  
  return (readYaml || bashYaml) && configCorrect;
});

s.checkBehavior("created-output-dir", "Agent created output/ directory", () => {
  if (!s.hasTranscript()) return false;
  const bashes = s.toolCalls("bash");
  const writes = s.toolCalls("write");
  
  // Check if agent ran mkdir for output/
  const mkdirOutput = bashes.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return /mkdir.*output/i.test(cmd);
  });
  
  // Or used write() which auto-creates directories
  const wroteToOutput = writes.some(tc => {
    const p = String((tc.arguments || {}).path || "");
    return /output\//i.test(p);
  });
  
  return mkdirOutput || wroteToOutput;
});

s.checkBehavior("found-validator-path", "Agent found validator/ (not validators/) path", () => {
  if (!s.hasTranscript()) return false;
  const bashes = s.toolCalls("bash");
  const reads = s.toolCalls("read");
  
  // Agent should have discovered the correct path
  // Evidence: ran ls/find to discover it, or tried validators/ then found validator/
  const usedCorrectPath = bashes.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return /validator\/check-schema/i.test(cmd) && !/validators\//i.test(cmd);
  });
  
  const searchedForIt = bashes.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return /(ls|find|tree)/.test(cmd);
  });
  
  const readValidator = reads.some(tc => {
    const p = String((tc.arguments || {}).path || "");
    return /validator\/check-schema/i.test(p);
  });
  
  return usedCorrectPath || (searchedForIt && (usedCorrectPath || readValidator));
});

s.checkBehavior("documented-obstacles", "migration-report.md documents obstacles encountered", () => {
  const raw = s.readFile("migration-report.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  
  // Should mention at least 2 of the 3 obstacles
  let obstaclesMentioned = 0;
  if (lower.includes("yaml") || lower.includes("syntax") || lower.includes("malformed") || lower.includes("retry_count")) obstaclesMentioned++;
  if (lower.includes("directory") || lower.includes("mkdir") || lower.includes("output/") || lower.includes("not exist")) obstaclesMentioned++;
  if (lower.includes("validator") && (lower.includes("path") || lower.includes("wrong") || lower.includes("not found") || lower.includes("validators"))) obstaclesMentioned++;
  
  return obstaclesMentioned >= 2;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 30", () => {
  return s.ops() <= 30;
});

s.report();
