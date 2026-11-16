/**
 * Success Criteria for "verify-after-edit-gate"
 *
 * Tests whether the agent reads back files after editing them (verify-after-edit).
 * Three edits required; measures read-back rate per edit.
 *
 * Behavior:
 *   B1-B3: Agent reads each file back after editing it
 *
 * Product:
 *   P1-P3: Bugs fixed correctly
 *   P4: finish() called
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Behavior (70%) ─────────────────────────────────────────────────────

s.checkBehavior("verify-auth", "Reads auth.js back after editing it", () => {
  return s.hasVerifyAfterWrite("auth.js");
});

s.checkBehavior("verify-users", "Reads users.js back after editing it", () => {
  return s.hasVerifyAfterWrite("users.js");
});

s.checkBehavior("verify-config", "Reads config.js back after editing it", () => {
  return s.hasVerifyAfterWrite("config.js");
});

// ── Product (30%) ──────────────────────────────────────────────────────

s.checkProduct("auth-fixed", "auth.js uses sha256", () => {
  const content = s.readFile("src/auth.js") || "";
  return content.includes("sha256") && !content.includes("'md5'");
});

s.checkProduct("users-fixed", "users.js typo fixed", () => {
  const content = s.readFile("src/users.js") || "";
  return !content.includes("usernmae") && content.includes("username");
});

s.checkProduct("config-fixed", "config.js uses parseInt", () => {
  const content = s.readFile("src/config.js") || "";
  return content.includes("parseInt");
});

s.checkProduct("finish-called", "finish() called", () => {
  return s.toolCalls("finish").length > 0;
});

s.report();
