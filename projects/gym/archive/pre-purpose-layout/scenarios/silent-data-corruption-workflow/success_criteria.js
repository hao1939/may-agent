/**
 * Silent Data Corruption Workflow Scorer
 * 
 * Same product checks as silent-data-corruption, plus workflow compliance:
 * - Agent wrote DATA-AUDIT.md before editing code
 * - DATA-AUDIT.md mentions existing data/backward-compatibility
 * - Existing hex data is handled (not corrupted)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Workflow: DATA-AUDIT.md exists ──────────────────────────────

s.checkProduct("data-audit-exists", "DATA-AUDIT.md was created", () => {
  const auditPath = path.join(workDir, "DATA-AUDIT.md");
  return fs.existsSync(auditPath);
});

s.checkProduct("data-audit-mentions-existing", "DATA-AUDIT.md mentions existing data or backward compatibility", () => {
  try {
    const auditPath = path.join(workDir, "DATA-AUDIT.md");
    const content = fs.readFileSync(auditPath, "utf8").toLowerCase();
    return content.includes("existing") || content.includes("backward") || 
           content.includes("migration") || content.includes("hex") ||
           content.includes("old format") || content.includes("current data");
  } catch {
    return false;
  }
});

s.checkProduct("data-audit-before-code-edit", "DATA-AUDIT.md was written before code changes (heuristic: audit file exists and has content)", () => {
  try {
    const auditPath = path.join(workDir, "DATA-AUDIT.md");
    const content = fs.readFileSync(auditPath, "utf8");
    return content.length > 50; // Non-trivial audit
  } catch {
    return false;
  }
});

// ── Product: Tests pass ─────────────────────────────────────────

s.checkProduct("tests-pass", "node test.js passes", () => {
  try {
    execSync("node test.js", { cwd: workDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// ── Product: Existing hex data is handled ───────────────────────

s.checkProduct("existing-data-not-corrupted", "getColor returns valid RGB for user with old hex data", () => {
  try {
    const modPath = path.resolve(workDir, "settings.js");
    delete require.cache[modPath];
    
    // Write a settings file with old hex format to test backward compat
    const settingsPath = path.join(workDir, "user-settings.json");
    const currentSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    
    // Check if any existing user's color can be retrieved as RGB
    const settings = require(modPath);
    
    // Try getting color for any existing user
    const users = Object.keys(currentSettings);
    if (users.length === 0) return false;
    
    const color = settings.getColor(users[0]);
    // Should be an RGB object, not a hex string
    return color && typeof color === "object" && "r" in color && "g" in color && "b" in color;
  } catch {
    return false;
  }
});

s.checkProduct("new-format-works", "setColor with RGB object works correctly", () => {
  try {
    const modPath = path.resolve(workDir, "settings.js");
    delete require.cache[modPath];
    const settings = require(modPath);
    
    settings.setColor("test-user-workflow", { r: 128, g: 64, b: 32 });
    const color = settings.getColor("test-user-workflow");
    return color && color.r === 128 && color.g === 64 && color.b === 32;
  } catch {
    return false;
  }
});

s.report();
