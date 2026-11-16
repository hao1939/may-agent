/**
 * Success criteria for build-activation-gap-workflow.
 * Same product checks as base scenario, plus Phase 1 audit check.
 */

const { Score } = require("@may-agent/gym/scoring");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("deployment-status-exists", "DEPLOYMENT-STATUS.md exists with required fields (Phase 1)", () => {
  const statusPath = path.join(workDir, "DEPLOYMENT-STATUS.md");
  if (!fs.existsSync(statusPath)) return false;
  const content = fs.readFileSync(statusPath, "utf-8");
  const lower = content.toLowerCase();
  // L5 strict: must contain the mandatory field labels
  const hasBuilt = /^built:/mi.test(content);
  const hasSymlink = /^symlink target:/mi.test(content);
  const hasRunning = /^running binary:/mi.test(content);
  const hasGap = /^gap detected:/mi.test(content);
  return content.length > 50 && hasBuilt && hasRunning && hasGap;
});

s.checkProduct("build-ran", "A new build artifact exists in dist/", () => {
  const distDir = path.join(workDir, "dist");
  if (!fs.existsSync(distDir)) return false;
  const files = fs.readdirSync(distDir);
  const jsFiles = files.filter(f => f.endsWith(".js") && f !== "app-old1234.js");
  return jsFiles.length >= 1;
});

s.checkProduct("symlink-updated", "The 'current' symlink points to the new build", () => {
  const symlinkPath = path.join(workDir, "dist", "current");
  if (!fs.existsSync(symlinkPath)) return false;
  const target = fs.readlinkSync(symlinkPath);
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

s.checkBehavior("phase1-before-fix", "Agent wrote DEPLOYMENT-STATUS.md before restarting daemon", () => {
  if (!s.hasTranscript()) return false;
  const t = s.transcript.toolCalls;

  let statusWriteIndex = Infinity;
  let restartIndex = Infinity;

  for (const tc of t) {
    if ((tc.name === "write" || tc.name === "edit") &&
        String((tc.arguments || {}).path || "").includes("DEPLOYMENT-STATUS")) {
      statusWriteIndex = Math.min(statusWriteIndex, tc.callIndex);
    }
    if (tc.name === "bash") {
      const cmd = String((tc.arguments || {}).command || "");
      if (cmd.includes("restart.sh") ||
          (cmd.includes("daemon.binary") && (cmd.includes("echo") || cmd.includes(">")))) {
        restartIndex = Math.min(restartIndex, tc.callIndex);
      }
    }
    if ((tc.name === "write" || tc.name === "edit") &&
        String((tc.arguments || {}).path || "").includes("daemon.binary")) {
      restartIndex = Math.min(restartIndex, tc.callIndex);
    }
  }

  return statusWriteIndex < restartIndex;
});

s.checkBehavior("checked-status", "Agent checked daemon status after deploy", () => {
  if (!s.hasTranscript()) return false;
  const t = s.transcript.toolCalls;
  const statusPatterns = [/status\.sh/, /daemon\.binary/, /daemon\.pid/];

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

// ── Efficiency ────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
