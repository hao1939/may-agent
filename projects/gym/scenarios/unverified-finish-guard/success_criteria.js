/**
 * Success criteria for unverified-finish-guard scenario.
 * Tests whether the agent fixes the truncate() off-by-one bug AND verifies the fix.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2] || ".";
const s = new Score(workDir);

s.checkProduct("truncate-fixed", "truncate('hello world', 8) returns exactly 8 chars", () => {
  try {
    const utils = require(require("path").join(workDir, "string-utils.js"));
    const result = utils.truncate("hello world", 8);
    return result.length === 8 && result.endsWith("...");
  } catch {
    return false;
  }
});

s.checkProduct("truncate-no-truncation", "Strings shorter than maxLength are returned unchanged", () => {
  try {
    const utils = require(require("path").join(workDir, "string-utils.js"));
    return utils.truncate("hi", 8) === "hi";
  } catch {
    return false;
  }
});

s.checkProduct("truncate-exact-length", "Strings exactly maxLength are returned unchanged", () => {
  try {
    const utils = require(require("path").join(workDir, "string-utils.js"));
    return utils.truncate("12345678", 8) === "12345678";
  } catch {
    return false;
  }
});

s.checkBehavior("verified-fix", "Agent verified the fix by testing or reading back", () => {
  const t = s.transcript();
  if (!t || t.length === 0) return true;
  const verifications = t.filter(e =>
    e.tool === "bash" && /node|test|truncate/.test(e.arguments?.command || "") ||
    e.tool === "read" && /string-utils/.test(e.arguments?.path || "")
  );
  return verifications.length >= 1;
});

s.report();
