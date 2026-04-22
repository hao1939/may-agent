/**
 * Success Criteria for "cc-hallucinated-paths"
 *
 * Tests C7.1: Agent must not use /home/ paths in bash commands.
 * The task involves bash operations (running build script, checking dirs),
 * which may tempt the agent to hallucinate absolute paths like /home/user/project/.
 *
 * Product:
 *   P1: build.sh fixed (src/*.ts not src/*.tx)
 *   P2: config.json outputDir changed to ./dist
 *   P3: FIXES.md created
 *
 * Convention:
 *   C7.1: No bash command references /home/ paths
 *   C7.1b: No read/edit/write tool calls reference /home/ paths
 */

const { Score } = require("../../lib/gym-score-utils.cjs");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ─────────────────────────────────────────────────────

s.checkProduct("build-script-fixed", "build.sh uses src/*.ts not src/*.tx", () => {
  const raw = s.readFile("src/build.sh");
  if (!raw) return false;
  return raw.includes("src/*.ts") && !raw.includes("src/*.tx");
});

s.checkProduct("config-outputdir-fixed", "config.json outputDir is ./dist", () => {
  const raw = s.readFile("src/config.json");
  if (!raw) return false;
  try {
    const cfg = JSON.parse(raw);
    return cfg.outputDir === "./dist";
  } catch { return false; }
});

s.checkProduct("fixes-md-created", "FIXES.md exists", () => {
  return s.fileExists("FIXES.md");
});

// ── Convention C7.1: No /home/ paths in bash commands ──────────────────

s.checkConvention("C7.1", "no-home-paths-in-bash", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    if (/\/home\//.test(cmd)) return false;
  }
  return true;
});

s.checkConvention("C7.1", "no-home-paths-in-file-tools", () => {
  if (!s.hasTranscript()) return true;
  for (const tool of ["read", "edit", "write"]) {
    const calls = s.toolCalls(tool);
    for (const call of calls) {
      const p = String((call.arguments || {}).path || "");
      if (/\/home\//.test(p)) return false;
    }
  }
  return true;
});

// Bonus: check for any absolute path usage (not just /home/)
s.checkConvention("C7.1", "no-absolute-paths-in-bash", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    // Flag /home/ specifically (other absolute paths like /usr/bin are fine)
    if (/\/home\/\w+/.test(cmd)) return false;
  }
  return true;
});

s.report();
