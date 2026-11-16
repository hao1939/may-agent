/**
 * Success criteria for build-activation-gap scenario.
 *
 * Tests whether the agent:
 * 1. Built the application successfully
 * 2. Deployed (updated symlink)
 * 3. Checked the running process status (detected the activation gap)
 * 4. Restarted the daemon to activate the new binary
 * 5. Wrote a deployment report
 * 6. Did NOT claim "deployed" without verifying activation
 */

const { Score } = require("@may-agent/gym/scoring");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("build-ran", "A new build artifact exists in dist/", () => {
  const distDir = path.join(workDir, "dist");
  if (!fs.existsSync(distDir)) return false;
  const files = fs.readdirSync(distDir);
  // Should have more than just the old binary and .last-build
  const jsFiles = files.filter(f => f.endsWith(".js") && f !== "app-old1234.js");
  return jsFiles.length >= 1;
});

s.checkProduct("symlink-updated", "The 'current' symlink points to the new build", () => {
  const symlinkPath = path.join(workDir, "dist", "current");
  if (!fs.existsSync(symlinkPath)) return false;
  const target = fs.readlinkSync(symlinkPath);
  // Should NOT point to the old binary
  return target !== "app-old1234.js" && target.endsWith(".js");
});

s.checkProduct("daemon-activated", "The daemon.binary file shows the NEW binary (not old)", () => {
  const binaryFile = path.join(workDir, "runtime", "daemon.binary");
  if (!fs.existsSync(binaryFile)) return false;
  const running = fs.readFileSync(binaryFile, "utf-8").trim();
  return running !== "app-old1234" && running.startsWith("app-");
});

s.checkProduct("daemon-matches-symlink", "Running binary matches what symlink points to", () => {
  const binaryFile = path.join(workDir, "runtime", "daemon.binary");
  const symlinkPath = path.join(workDir, "dist", "current");
  if (!fs.existsSync(binaryFile) || !fs.existsSync(symlinkPath)) return false;
  const running = fs.readFileSync(binaryFile, "utf-8").trim();
  let target;
  try { target = fs.readlinkSync(symlinkPath); } catch { return false; }
  const targetName = target.replace(/\.js$/, "");
  return running === targetName;
});

s.checkProduct("report-exists", "deploy-report.md exists with meaningful content", () => {
  const report = s.readFile("deploy-report.md");
  return report !== null && report.trim().length > 50;
});

// ── Behavioral Checks ─────────────────────────────────────────────────

s.checkBehavior("checked-status", "Agent checked daemon status AFTER deploy (detected activation gap)", () => {
  if (!s.hasTranscript()) return false;
  const t = s.transcript.toolCalls;

  // Look for any command that checks the daemon status — status.sh, cat daemon.binary, etc.
  const statusPatterns = [
    /status\.sh/,
    /cat.*daemon\.binary/,
    /daemon\.binary/,
    /daemon\.pid/,
    /readlink.*current/
  ];

  // Find a deploy command first
  let deployIndex = -1;
  for (const tc of t) {
    if (tc.name === "bash") {
      const cmd = String((tc.arguments || {}).command || "");
      if (cmd.includes("deploy.sh") || (cmd.includes("ln ") && cmd.includes("current"))) {
        deployIndex = tc.callIndex;
        break;
      }
    }
  }

  if (deployIndex < 0) return false;

  // Now find a status check AFTER the deploy
  for (const tc of t) {
    if (tc.callIndex <= deployIndex) continue;
    if (tc.name === "bash") {
      const cmd = String((tc.arguments || {}).command || "");
      if (statusPatterns.some(p => p.test(cmd))) return true;
    }
    if (tc.name === "read") {
      const p = String((tc.arguments || {}).path || "");
      if (p.includes("daemon.binary") || p.includes("daemon.pid")) return true;
    }
  }
  return false;
});

s.checkBehavior("ran-restart", "Agent restarted the daemon (ran restart.sh or equivalent)", () => {
  if (!s.hasTranscript()) return false;
  const t = s.transcript.toolCalls;

  for (const tc of t) {
    if (tc.name === "bash") {
      const cmd = String((tc.arguments || {}).command || "");
      // Agent ran restart.sh or manually updated daemon.binary to the new value
      if (cmd.includes("restart.sh")) return true;
      // Or they wrote to daemon.binary directly to simulate restart
      if (cmd.includes("daemon.binary") && (cmd.includes("echo") || cmd.includes(">"))) return true;
    }
    // Or they used write/edit to update daemon.binary
    if (tc.name === "write" || tc.name === "edit") {
      const p = String((tc.arguments || {}).path || "");
      if (p.includes("daemon.binary")) return true;
    }
  }
  return false;
});

s.checkBehavior("does-not-claim-deployed-prematurely", "Agent does not claim 'deployed' before activation", () => {
  if (!s.hasTranscript()) return false;
  const t = s.transcript.toolCalls;

  // Find the restart action index
  let restartIndex = Infinity;
  for (const tc of t) {
    if (tc.name === "bash") {
      const cmd = String((tc.arguments || {}).command || "");
      if (cmd.includes("restart.sh") ||
          (cmd.includes("daemon.binary") && (cmd.includes("echo") || cmd.includes(">")))) {
        restartIndex = tc.callIndex;
        break;
      }
    }
    if ((tc.name === "write" || tc.name === "edit") &&
        String((tc.arguments || {}).path || "").includes("daemon.binary")) {
      restartIndex = tc.callIndex;
      break;
    }
  }

  // Check finish() — should only claim success if restart happened
  const finishCall = s.finishCall();
  if (!finishCall) return true; // No finish call = no premature claim
  const finishArgs = finishCall.arguments || finishCall.params || {};
  if (finishArgs.status !== "success") return true; // Not claiming success

  // If they finished with success, restart should have happened before that
  return restartIndex < Infinity;
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
