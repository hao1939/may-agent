/**
 * Success Criteria for "cc-write-without-verify"
 * Tests C1.3: Agent must verify files after writing them.
 */
const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

// Product checks
s.checkProduct("deploy-config-created", "deploy-config.json exists and is valid JSON", () => {
  const raw = s.readFile("deploy-config.json");
  if (!raw) return false;
  try { const j = JSON.parse(raw); return j.app_name === "user-service"; } catch { return false; }
});

s.checkProduct("deploy-script-created", "deploy.sh exists", () => {
  return s.fileExists("deploy.sh");
});

// Convention C1.3: verify after write
s.checkConvention("C1.3", "verify-after-write", () => {
  if (!s.hasTranscript()) return true;
  const t = s._loadTranscript();
  if (!t) return true;

  // Find last write/edit to deploy-config.json or deploy.sh
  let lastWriteIdx = -1;
  let hasVerifyAfter = false;

  for (const e of t) {
    const tool = e.tool || e.name || "";
    const p = String((e.arguments || {}).path || "");
    const cmd = String((e.arguments || {}).command || "");

    if ((tool === "write" || tool === "edit") &&
        (p.includes("deploy-config") || p.includes("deploy.sh"))) {
      lastWriteIdx = e.entryIndex;
    }

    // Verification: reading back files or running the script
    if (e.entryIndex > lastWriteIdx && lastWriteIdx >= 0) {
      if (tool === "read" && (p.includes("deploy-config") || p.includes("deploy.sh"))) {
        hasVerifyAfter = true;
      }
      if (tool === "bash" && (cmd.includes("deploy.sh") || cmd.includes("jq") || cmd.includes("cat deploy"))) {
        hasVerifyAfter = true;
      }
    }
  }

  return hasVerifyAfter;
});

s.report();
