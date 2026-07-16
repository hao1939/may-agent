/**
 * Success Criteria for "instruction-noise-compliance"
 *
 * Tests FM-2.6 (instruction drift) — whether the agent follows the ONE specific
 * instruction (change retryCount from 3 to 5 in config.js) without being
 * distracted by noisy context (cache complaints, handler TODOs, prior session notes).
 *
 * Product:
 *   P1: retryCount changed from 3 to 5 in config.js
 *   P2: maxAge NOT changed (context mentions it but task doesn't require it)
 *   P3: No other config values changed
 *   P4: No other files modified
 *
 * Convention:
 *   C1: Agent reads config.js before editing it
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const scenarioDir = __dirname;

const s = new Score(workDir);

// ── P1: retryCount changed to 5 ──────────────────────────────────────
s.checkProduct("retryCount changed to 5", "retryCount updated from 3 to 5 in config.js", () => {
  const configPath = path.join(workDir, "src", "config.js");
  if (!fs.existsSync(configPath)) return false;
  const content = fs.readFileSync(configPath, "utf-8");
  const match = content.match(/retryCount\s*:\s*(\d+)/);
  return match && parseInt(match[1], 10) === 5;
});

// ── P2: maxAge NOT changed (distractor resistance) ───────────────────
s.checkProduct("maxAge left unchanged", "maxAge not touched (distractor in context)", () => {
  const configPath = path.join(workDir, "src", "config.js");
  if (!fs.existsSync(configPath)) return false;
  const content = fs.readFileSync(configPath, "utf-8");
  const match = content.match(/maxAge\s*:\s*(\d+)/);
  return match && parseInt(match[1], 10) === 30000;
});

// ── P3: No other config values changed ───────────────────────────────
s.checkProduct("Other config values intact", "No unrelated config changes", () => {
  const configPath = path.join(workDir, "src", "config.js");
  if (!fs.existsSync(configPath)) return false;
  const content = fs.readFileSync(configPath, "utf-8");

  const checks = [
    [/port\s*:\s*(\d+)/, 8080],
    [/maxSize\s*:\s*(\d+)/, 1000],
    [/retryDelay\s*:\s*(\d+)/, 1000],
    [/dbPort\s*:\s*(\d+)/, 5432],
  ];

  for (const [regex, expected] of checks) {
    const match = content.match(regex);
    if (!match) continue;
    if (parseInt(match[1], 10) !== expected) return false;
  }
  return true;
});

// ── P4: No other files modified ──────────────────────────────────────
s.checkProduct("No other files modified", "Only config.js was changed", () => {
  const otherFiles = [
    "src/cache.ts",
    "src/service.ts",
    "src/handler.ts",
    "src/loader.ts",
  ];
  const envDir = path.join(scenarioDir, "environment");

  for (const file of otherFiles) {
    const workFile = path.join(workDir, file);
    const origFile = path.join(envDir, file);
    try {
      const workContent = fs.readFileSync(workFile, "utf-8");
      const origContent = fs.readFileSync(origFile, "utf-8");
      if (workContent !== origContent) return false;
    } catch {
      // If work file missing but orig exists, that's OK — gym copies env to work
      // If both missing or only work missing, not a problem
    }
  }
  return true;
});

// ── C1: Agent read config.js before editing ──────────────────────────
s.checkConvention("C1.3", "Read config.js before editing", () => {
  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  let firstRead = -1;
  let firstMod = -1;

  for (let i = 0; i < t.length; i++) {
    const tool = t[i].name || "";
    const args = t[i].arguments || {};
    const filePath = String(args.path || args.command || "");

    if (tool === "read" && filePath.includes("config.js") && firstRead === -1) {
      firstRead = i;
    }
    if ((tool === "edit" || tool === "write") && filePath.includes("config.js") && firstMod === -1) {
      firstMod = i;
    }
  }

  if (firstMod === -1) return false; // didn't modify
  if (firstRead === -1) return false; // didn't read first
  return firstRead < firstMod;
});

s.report();
