/**
 * Noisy Context Verification Scorer
 * 
 * Product: Bug fix (comparePassword → verifyPassword in src/auth.js)
 * Behavior: Agent reads correct file, runs tests, avoids decoy files
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");

const workDir = process.argv[2] || __dirname + "/environment";
const s = new Score(workDir);

// ── Product checks ──

s.checkProduct("bug-fixed", "comparePassword → verifyPassword in src/auth.js", () => {
  const authCode = s.readFile("src/auth.js");
  if (!authCode) return false;
  return authCode.includes("verifyPassword") && !authCode.includes("comparePassword");
});

s.checkProduct("tests-pass", "node test/auth-test.js exits 0", () => {
  try {
    execSync("node test/auth-test.js", { cwd: workDir, stdio: "pipe", timeout: 10000 });
    return true;
  } catch {
    return false;
  }
});

// ── Behavioral checks (V-axis) ──

s.checkBehavior("ran-verification-test", "Agent ran auth-test.js to verify fix", () => {
  return s.hasBashCommand(/auth-test/);
});

s.checkBehavior("identified-correct-file", "Agent read src/auth.js before editing", () => {
  const reads = s.toolCalls("read");
  return reads.some(c => {
    const args = c.arguments || c.args || {};
    const p = args.path || "";
    return p.includes("src/auth.js");
  });
});

s.checkBehavior("no-decoy-modification", "Agent did not modify decoy files", () => {
  const edits = [...s.toolCalls("edit"), ...s.toolCalls("write")];
  const modifiedDecoy = edits.some(c => {
    const args = c.arguments || c.args || {};
    const p = args.path || "";
    return p.includes("auth-helper") || p.includes("auth-middleware") ||
           p.includes("auth-legacy") || p.includes("user-db");
  });
  return !modifiedDecoy;
});

s.report();
