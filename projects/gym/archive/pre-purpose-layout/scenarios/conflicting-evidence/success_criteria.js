/**
 * Success criteria for conflicting-evidence scenario.
 *
 * The bug: db.js hardcodes port 5432 (from old hotfix) even though .env says 5433
 * (DB was migrated). README also says 5432 (stale docs). The error log shows
 * ECONNREFUSED on port 5432, confirming nothing is listening there.
 *
 * Good agent behavior:
 * 1. Reads error log → sees port 5432 is refused
 * 2. Reads .env → sees port 5433 (correct DB port)
 * 3. Reads db.js → finds hardcoded port 5432 override
 * 4. Identifies the conflict and fixes db.js to use DB_CONFIG.port
 * 5. Writes a fix summary mentioning the conflicting sources
 *
 * Bad agent behavior:
 * - Reads README, sees 5432, changes .env to 5432 (wrong — follows stale docs)
 * - Only checks one config source and misses the hardcoded override
 * - Fixes .env to 5432 instead of fixing db.js to use 5433
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// P1: Fix summary exists
// Agent may write to "fix-summary.md" or "environment/fix-summary.md" depending on task interpretation
s.checkProduct("fix-summary-exists", "Fix summary was created", () => {
  const summary = s.readFile("fix-summary.md") || s.readFile("environment/fix-summary.md");
  return summary !== null && summary.trim().length > 50;
});

// P2: The actual fix — db.js should use DB_CONFIG.port (not hardcoded 5432)
// Note: gym runner copies environment/* directly into workDir, so db.js is at src/db.js
s.checkProduct("db-port-fixed", "db.js no longer hardcodes port 5432", () => {
  const db = s.readFile("src/db.js");
  if (!db) return false;
  // The Pool config should reference DB_CONFIG.port, not a literal 5432
  // Check that port line in Pool constructor uses config, not hardcoded
  const poolSection = db.substring(db.indexOf('new Pool'), db.indexOf('});') + 3);
  const hasHardcoded5432 = /port:\s*5432/.test(poolSection);
  const usesConfig = /port:\s*DB_CONFIG\.port/.test(poolSection) ||
                     /port:\s*parseInt/.test(poolSection) ||
                     /port:\s*config\.port/.test(poolSection);
  return !hasHardcoded5432 && usesConfig;
});

// P3: .env still has 5433 (agent didn't wrongly change it to 5432)
s.checkProduct("env-preserved", ".env still has correct port 5433", () => {
  const env = s.readFile(".env");
  if (!env) return false;
  return env.includes("DB_PORT=5433");
});

// P4: Fix summary mentions the conflict between sources
s.checkProduct("identifies-conflict", "Summary identifies conflicting configuration sources", () => {
  const summary = s.readFile("fix-summary.md") || s.readFile("environment/fix-summary.md");
  if (!summary) return false;
  const lower = summary.toLowerCase();
  // Should mention at least 2 of: db.js hardcoded, .env port, README stale
  let mentions = 0;
  if (lower.includes('hardcod') || lower.includes('db.js') || lower.includes('pinned')) mentions++;
  if (lower.includes('.env') || lower.includes('5433')) mentions++;
  if (lower.includes('readme') || lower.includes('stale') || lower.includes('outdated')) mentions++;
  return mentions >= 2;
});

// B1: Agent read the error log
s.checkBehavior("read-error-log", "Agent read the error log to understand the symptom", () => {
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  const readLog = reads.some(c => {
    const path = String((c.arguments || {}).path || "");
    return path.includes("app.log") || path.includes("logs");
  });
  const catLog = bashCalls.some(c => {
    const cmd = String((c.arguments || {}).command || "");
    return cmd.includes("app.log") || cmd.includes("logs");
  });
  return readLog || catLog;
});

// B2: Agent checked multiple config sources (not just one)
s.checkBehavior("multiple-sources-checked", "Agent checked at least 3 different config-relevant files", () => {
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  
  const allPaths = [
    ...reads.map(c => String((c.arguments || {}).path || "")),
    ...bashCalls.map(c => String((c.arguments || {}).command || ""))
  ].join(" ");
  
  let sources = 0;
  if (allPaths.includes(".env")) sources++;
  if (allPaths.includes("config.js") || allPaths.includes("config")) sources++;
  if (allPaths.includes("db.js")) sources++;
  if (allPaths.includes("README")) sources++;
  
  return sources >= 3;
});

// B3: Agent did NOT wrongly modify .env to port 5432
s.checkBehavior("no-wrong-env-change", "Agent did not change .env port to 5432 (which would be the wrong fix)", () => {
  const env = s.readFile(".env");
  if (!env) return true; // if .env doesn't exist, at least they didn't break it this way
  return !env.includes("DB_PORT=5432");
});

s.report();
