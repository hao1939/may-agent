/**
 * Gym Runner — runs agent gym scenarios and outputs GymResult JSON.
 *
 * Compiles to JS via esbuild (or sed type-strip fallback) and runs under node v18.
 * Only uses Node.js built-in modules: fs, path, child_process, os, crypto.
 *
 * CLI:
 *   node runner.js <scenario> [--agent <name>] [--lab <fork>] [--timeout <min>]
 *                              [--adapter <name>] [--keep]
 *   node runner.js --list [--tier <t>] [--tag <t>] [--category <c>]
 *   node runner.js --run-all [--tier <t>] [--agent <name>] [--timeout <min>]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { fileURLToPath } from "url";
import { fileURLToPath as __fU2P } from "node:url";
import { dirname as __dn } from "node:path";
const __filename = __fU2P(import.meta.url);
const __dirname = __dn(__filename);


// ESM-compatible __dirname shim (esbuild bundles to .mjs)
const __filename_esm = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const __dirname_esm = typeof __dirname !== "undefined" ? __dirname : path.dirname(__filename_esm);

// ── Interfaces (stripped during JS compilation) ──────────────────────




// ── Path resolution ──────────────────────────────────────────────────

const SCRIPT_DIR = __dirname_esm;
// runner.ts lives at src/gym/ — project root is 2 levels up.
// But when compiled to a temp file, __dirname may differ.
// Use GYM_PROJECT_ROOT env or walk up looking for agents/gym/scenarios.
function findProjectRoot() {
  const envRoot = process.env["GYM_PROJECT_ROOT"];
  if (envRoot && fs.existsSync(path.join(envRoot, "agents", "gym", "scenarios"))) {
    return envRoot;
  }
  // Walk up from __dirname
  let dir = SCRIPT_DIR;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "agents", "gym", "scenarios"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: cwd
  if (fs.existsSync(path.join(process.cwd(), "agents", "gym", "scenarios"))) {
    return process.cwd();
  }
  // Output a valid JSON error to stdout before exiting so callers always get parseable output
  const errorResult = {
    scenario: "",
    agent: "",
    lab_fork: null,
    passed: false,
    checks: [],
    summary: "Cannot find project root (agents/gym/scenarios not found)",
    agent_status: "error",
    duration: "0s",
    gym_root: "",
  };
  process.stdout.write(JSON.stringify(errorResult, null, 2) + "\n");
  process.stderr.write("ERROR: Cannot find project root (agents/gym/scenarios not found)\n");
  process.exit(1);
}

const PROJECT_ROOT = findProjectRoot();
const SCENARIOS_DIR = path.join(PROJECT_ROOT, "agents", "gym", "scenarios");

// ── Arg parsing ──────────────────────────────────────────────────────


function parseArgs(argv ) {
  const args = {
    scenario: "",
    agent: "coder",
    lab: "",
    timeout: 5,
    adapter: "may-agent",
    keep: false,
    list: false,
    runAll: false,
    tier: "",
    tag: "",
    category: "",
  };

  const rest = argv.slice(2); // skip node + script
  let i = 0;
  while (i < rest.length) {
    const a = String(rest[i]);
    if (a === "--list") {
      args.list = true;
    } else if (a === "--run-all") {
      args.runAll = true;
    } else if (a === "--keep") {
      args.keep = true;
    } else if (a === "--agent" && i + 1 < rest.length) {
      i++;
      args.agent = rest[i];
    } else if (a === "--lab" && i + 1 < rest.length) {
      i++;
      args.lab = rest[i];
    } else if (a === "--timeout" && i + 1 < rest.length) {
      i++;
      args.timeout = parseInt(rest[i], 10) || 5;
    } else if (a === "--adapter" && i + 1 < rest.length) {
      i++;
      args.adapter = rest[i];
    } else if (a === "--tier" && i + 1 < rest.length) {
      i++;
      args.tier = rest[i];
    } else if (a === "--tag" && i + 1 < rest.length) {
      i++;
      args.tag = rest[i];
    } else if (a === "--category" && i + 1 < rest.length) {
      i++;
      args.category = rest[i];
    } else if (!a.startsWith("--") && !args.scenario) {
      args.scenario = a;
    }
    i++;
  }
  return args;
}

// ── Scenario discovery ───────────────────────────────────────────────

function loadScenarioMeta(scenarioName ) {
  const jsonPath = path.join(SCENARIOS_DIR, scenarioName, "scenario.json");
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  } catch {
    return null;
  }
}

function listAllScenarios() {
  if (!fs.existsSync(SCENARIOS_DIR)) return [];
  return fs.readdirSync(SCENARIOS_DIR).filter((d) => {
    return fs.existsSync(path.join(SCENARIOS_DIR, d, "task.md"));
  }).sort();
}

// Tier hierarchy: smoke ⊂ standard ⊂ full
const TIER_LEVELS = { smoke: 1, standard: 2, full: 3 };

function filterScenarios(names , tier , tag , category ) {
  return names.filter((name) => {
    const meta = loadScenarioMeta(name);
    if (!meta) return false;
    if (tier) {
      const requestedLevel = TIER_LEVELS[tier] || 3;
      const scenarioLevel = TIER_LEVELS[meta.tier] || 3;
      // A tier filter includes all scenarios AT or BELOW that tier level
      if (scenarioLevel > requestedLevel) return false;
    }
    if (tag && !(meta.tags || []).includes(tag)) return false;
    if (category && !(meta.categories || []).includes(category)) return false;
    return true;
  });
}

// ── Temp dir management ──────────────────────────────────────────────

function createTempDir(scenarioName ) {
  const id = crypto.randomBytes(4).toString("hex");
  const tmpDir = path.join(os.tmpdir(), `gym-${scenarioName}-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function copyEnvironment(scenarioName , destDir ) {
  const envDir = path.join(SCENARIOS_DIR, scenarioName, "environment");
  if (!fs.existsSync(envDir)) return;
  // Check if the scenario expects the "environment/" subdirectory to be preserved.
  // If task.md or success_criteria.js references "environment/", preserve the directory name.
  // Otherwise, flatten contents into destDir for backward compatibility.
  const taskPath = path.join(SCENARIOS_DIR, scenarioName, "task.md");
  const criteriaPath = path.join(SCENARIOS_DIR, scenarioName, "success_criteria.js");
  let preserveEnvDir = false;
  try {
    const taskContent = fs.existsSync(taskPath) ? fs.readFileSync(taskPath, "utf-8") : "";
    const criteriaContent = fs.existsSync(criteriaPath) ? fs.readFileSync(criteriaPath, "utf-8") : "";
    // If criteria reference "environment/" paths, preserve the directory structure
    if (criteriaContent.includes('"environment/') || criteriaContent.includes("'environment/")) {
      preserveEnvDir = true;
    }
  } catch {
    // Default to flat copy on error
  }

  const targetDir = preserveEnvDir ? path.join(destDir, "environment") : destDir;
  if (preserveEnvDir) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  try {
    // Always use shell cp to flatten contents correctly.
    // fs.cpSync copies the directory itself INTO targetDir (creating targetDir/environment/),
    // but we want the CONTENTS of envDir flattened into targetDir.
    execSync(`cp -r "${envDir}/." "${targetDir}/"`, { stdio: "pipe" });
  } catch {
    // Fallback to cpSync (may create nested environment/ dir)
    fs.cpSync(envDir, targetDir, { recursive: true });
  }
}

function cleanupTempDir(tmpDir ) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// ── Agent adapters ───────────────────────────────────────────────────


/**
 * Snapshot files in a directory (non-recursive, top-level only).
 * Returns a Set of filenames.
 */
function snapshotDir(dir ) {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return new Set();
  }
}

/**
 * After agent runs, the binary may write output files to PROJECT_ROOT
 * instead of workDir (--work-dir not fully supported). Detect new files
 * in PROJECT_ROOT and copy them to workDir so success_criteria.js can find them.
 */
function syncNewFilesFromRoot(beforeSnapshot , workDir ) {
  const after = snapshotDir(PROJECT_ROOT);
  for (const file of after) {
    if (!beforeSnapshot.has(file) && !file.startsWith(".") && !file.startsWith("_")) {
      const srcPath = path.join(PROJECT_ROOT, file);
      const destPath = path.join(workDir, file);
      try {
        const stat = fs.statSync(srcPath);
        if (stat.isFile() && stat.size < 1024 * 1024) { // Only copy files < 1MB
          fs.copyFileSync(srcPath, destPath);
          // Clean up the file from PROJECT_ROOT (it shouldn't be there)
          fs.unlinkSync(srcPath);
        } else if (stat.isDirectory()) {
          // Agent may create directories (e.g. environment/) in PROJECT_ROOT
          // Copy the entire directory to workDir and clean up
          try {
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
          } catch {
            // best effort
          }
        }
      } catch {
        // best effort
      }
    }
  }
}

function runAgent(adapter , taskContent , workDir , agent , timeoutMs ) {
  // Prepend workDir notice so agent knows where scenario files are
  const workDirNotice = `**IMPORTANT: This is a gym scenario. All project files are in ${workDir} — read files from there, not from /app or your usual workspace.**\n\n`;
  taskContent = workDirNotice + taskContent;
  // Write task to work dir for reference
  fs.writeFileSync(path.join(workDir, "_gym_task.md"), taskContent);

  if (adapter === "generic") {
    const cmd = process.env["GYM_AGENT_CMD"];
    if (!cmd) {
      return { status: "skipped" };
    }
    try {
      const stdout = execSync(`${cmd} "${path.join(workDir, "_gym_task.md")}" "${workDir}"`, {
        cwd: workDir,
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf-8",
      });
      const transcriptPath = path.join(workDir, "_transcript.txt");
      fs.writeFileSync(transcriptPath, stdout || "");
      return { status: "completed", transcriptPath };
    } catch (err) {
      return { status: "error" };
    }
  }

  // may-agent adapter (default) — use GYM_AGENT_BIN env var to locate agent binary
  // If GYM_AGENT_BIN is not set, we're in stub mode (no real agent available).
  const agentBin = process.env["GYM_AGENT_BIN"] || "";

  if (!agentBin || !fs.existsSync(agentBin)) {
    // Stub mode — no real agent binary available
    fs.writeFileSync(
      path.join(workDir, "_gym_agent_stub.log"),
      `No agent binary found (GYM_AGENT_BIN not set or not found).\nTask written to _gym_task.md.\nStub mode — scenario scoring will run against unmodified environment.\n`
    );
    return { status: "skipped" };
  }

  // Snapshot PROJECT_ROOT before agent runs (agent may write there instead of workDir)
  const beforeSnapshot = snapshotDir(PROJECT_ROOT);
  // Record timestamp before agent runs so we can find the correct session later
  const agentStartTime = Date.now();

  // Real agent binary found via GYM_AGENT_BIN — invoke it
  // Read task file content and pass via env var to avoid shell escaping issues
  const taskFile = path.join(workDir, "_gym_task.md");
  const taskContent2 = fs.readFileSync(taskFile, "utf-8");
  let agentStdout = "";
  try {
    agentStdout = execSync(
      `"${agentBin}" --oneshot --agent "${agent}" --task "$GYM_TASK_CONTENT" --work-dir "${workDir}"`,
      {
        cwd: workDir,
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, GYM_WORK_DIR: workDir, GYM_TASK_CONTENT: taskContent2, GYM_EFFECTIVE_AGENT: agent },
      }
    ) || "";
  } catch (err) {
    // Agent may exit non-zero but still have done work
    const errObj = Object(err);
    agentStdout = (errObj.stdout || "").toString();
    if (errObj.killed) {
      // Save transcript even on timeout
      const transcriptPath = path.join(workDir, "_transcript.txt");
      fs.writeFileSync(transcriptPath, agentStdout);
      syncNewFilesFromRoot(beforeSnapshot, workDir);
      return { status: "timeout", transcriptPath };
    }
    // Non-zero exit — agent may have done partial work
    const transcriptPath = path.join(workDir, "_transcript.txt");
    fs.writeFileSync(transcriptPath, agentStdout);
    syncNewFilesFromRoot(beforeSnapshot, workDir);
    return { status: "error", transcriptPath };
  }

  // Save transcript (agent stdout contains session JSON and tool call logs)
  const transcriptPath = path.join(workDir, "_transcript.txt");
  fs.writeFileSync(transcriptPath, agentStdout);

  // Sync any files the agent created in PROJECT_ROOT back to workDir
  syncNewFilesFromRoot(beforeSnapshot, workDir);

  // Also check the most recent session's JSONL for a richer transcript
  // The binary writes session data to .state/sessions/
  try {
    const sessionsDir = path.join(PROJECT_ROOT, ".state", "sessions");
    if (fs.existsSync(sessionsDir)) {
      // Check both active sessions and history/ (completed sessions move there)
      let allSessionDirs = fs.readdirSync(sessionsDir)
        .filter((d) => d.startsWith("s_"));
      const historyDir = path.join(sessionsDir, "history");
      if (fs.existsSync(historyDir)) {
        const histDirs = fs.readdirSync(historyDir)
          .filter((d) => d.startsWith("s_"))
          .map((d) => "history/" + d);
        allSessionDirs = allSessionDirs.concat(histDirs);
      }
      const sessionDirs = allSessionDirs
        .filter((d) => {
          if (!/^(history\/)?s_\d+/.test(d)) return false;
          // Only consider sessions created after we started the agent
          const name = d.includes("/") ? d.split("/").pop() : d;
          const tsMatch = name.match(/^s_(\d+)/);
          if (tsMatch && agentStartTime) {
            const sessionTs = parseInt(tsMatch[1], 10);
            if (sessionTs < agentStartTime) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const nameA = a.includes("/") ? a.split("/").pop() : a;
          const nameB = b.includes("/") ? b.split("/").pop() : b;
          return nameB.localeCompare(nameA);
        });
      if (sessionDirs.length > 0) {
        // Find the session that matches our gym agent (check meta.json)
        let selectedSession = null;
        for (const sd of sessionDirs) {
          const metaPath = path.join(sessionsDir, sd, "meta.json");
          try {
            if (fs.existsSync(metaPath)) {
              const meta2 = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
              // Match agent name — use the agent parameter from runAgent scope
              if (agent && meta2.agent && meta2.agent !== agent) continue;
            }
          } catch { /* skip */ }
          // Check if session.jsonl exists and contains our gym task
          const jp = path.join(sessionsDir, sd, "session.jsonl");
          if (fs.existsSync(jp)) {
            // Verify this session is actually our gym run by checking for gym task marker
            const sessionContent = fs.readFileSync(jp, "utf-8").slice(0, 2000);
            if (sessionContent.includes("gym scenario") || sessionContent.includes("_gym_task")) {
              selectedSession = sd;
              break;
            }
            // If no gym marker found but timestamp matches closely (within 30s of agent start),
            // accept it as likely our session
            const sdName = sd.includes("/") ? sd.split("/").pop() : sd;
            const sdTs = parseInt((sdName.match(/^s_(\d+)/) || [])[1] || "0", 10);
            if (agentStartTime && sdTs >= agentStartTime && sdTs - agentStartTime < 30000) {
              selectedSession = sd;
              break;
            }
          }
        }
        const latestSession = selectedSession || sessionDirs[0];
        const jsonlPath = path.join(sessionsDir, latestSession, "session.jsonl");
        if (fs.existsSync(jsonlPath)) {
          const sessionData = fs.readFileSync(jsonlPath, "utf-8");
          // Append session JSONL to transcript for richer convention checking
          fs.appendFileSync(transcriptPath, "\n--- SESSION JSONL ---\n" + sessionData);
          // Save as _gym_transcript.jsonl for gym-score-utils.cjs Score class
          fs.writeFileSync(path.join(workDir, "_gym_transcript.jsonl"), sessionData);
          // Also save.jsonl in workDir for scenarios that look for it there
          fs.writeFileSync(path.join(workDir, "transcript.jsonl"), sessionData);
        }
      }
    }
  } catch {
    // best effort — transcript from stdout is still available
  }

  return { status: "completed", transcriptPath };
}

// ── Scoring ──────────────────────────────────────────────────────────

function runCriteria(scenarioName , workDir , transcriptPath ) {
  const criteriaPath = path.join(SCENARIOS_DIR, scenarioName, "success_criteria.js");
  if (!fs.existsSync(criteriaPath)) {
    return {
      passed: false,
      checks: [{ name: "criteria-exists", passed: false, detail: "success_criteria.js not found" }],
      summary: "No success_criteria.js found for scenario",
    };
  }

  // Build command: always pass workDir, optionally pass transcriptPath
  const transcriptArg = transcriptPath && fs.existsSync(transcriptPath) ? ` "${transcriptPath}"` : "";
  const cmd = `node "${criteriaPath}" "${workDir}"${transcriptArg}`;

  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.join(SCENARIOS_DIR, scenarioName),
    });

    // Parse JSON from stdout — find the last JSON object in output
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (!jsonMatch) {
      return {
        passed: false,
        checks: [{ name: "criteria-parse", passed: false, detail: "No JSON in criteria output" }],
        summary: "success_criteria.js produced no JSON output",
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    // Normalize checks: ensure message field exists (criteria may use "detail" instead)
    if (parsed.checks) {
      parsed.checks = parsed.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        message: c.message || c.detail || undefined,
      }));
    }
    return parsed;
  } catch (err) {
    // Criteria may exit non-zero but still output JSON
    const errObj = Object(err);
    const stdout = (errObj.stdout || "").toString();
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.checks) {
          parsed.checks = parsed.checks.map((c) => ({
            name: c.name,
            passed: c.passed,
            message: c.message || c.detail || undefined,
          }));
        }
        return parsed;
      } catch {
        // fall through
      }
    }
    return {
      passed: false,
      checks: [{ name: "criteria-run", passed: false, message: `Criteria error: ${(errObj.message || "").slice(0, 500)}` }],
      summary: `success_criteria.js failed: ${(errObj.message || "").slice(0, 200)}`,
    };
  }
}

// ── Single scenario run ──────────────────────────────────────────────

function runScenario(scenarioName , agent , lab , adapter , timeoutMinutes , keepDir ) {
  const startTime = Date.now();
  const meta = loadScenarioMeta(scenarioName);

  if (!meta) {
    return {
      scenario: scenarioName,
      agent,
      lab_fork: lab || null,
      passed: false,
      checks: [],
      summary: `Scenario "${scenarioName}" not found or has no scenario.json`,
      agent_status: "error",
      duration: "0s",
      gym_root: SCENARIOS_DIR,
    };
  }

  const taskPath = path.join(SCENARIOS_DIR, scenarioName, "task.md");
  if (!fs.existsSync(taskPath)) {
    return {
      scenario: scenarioName,
      agent,
      lab_fork: lab || null,
      passed: false,
      checks: [],
      summary: `Scenario "${scenarioName}" has no task.md`,
      agent_status: "error",
      duration: "0s",
      gym_root: SCENARIOS_DIR,
    };
  }

  const taskContent = fs.readFileSync(taskPath, "utf-8");
  const timeoutMs = (timeoutMinutes || meta.timeout || 5) * 60 * 1000;
  const tmpDir = createTempDir(scenarioName);

  try {
    // Copy environment to temp dir
    copyEnvironment(scenarioName, tmpDir);

    let agentStatus;
    let transcriptPath;

    // Use scenario's agent_type if specified, otherwise fall back to CLI arg
    // Map role types to agent names (agent_type is a role, not a name)
    const AGENT_TYPE_MAP = { "coder": "amy", "scout": "scout", "workflow": "amy", "any": "amy" };
    const rawAgent = agent || meta.agent_type || "amy";
    const effectiveAgent = AGENT_TYPE_MAP[rawAgent] || rawAgent;

    if (meta.workflow) {
      // Workflow: split task on --- delimiter, run phases sequentially
      const phases = taskContent.split(/\n---\n/).map((p ) => p.trim()).filter((p ) => p.length > 0);
      agentStatus = "completed";
      for (let pi = 0; pi < phases.length; pi++) {
        const phaseTask = phases[pi];
        const phaseResult = runAgent(adapter, phaseTask, tmpDir, effectiveAgent, timeoutMs);
        transcriptPath = phaseResult.transcriptPath || transcriptPath;
        if (phaseResult.status === "skipped") {
          agentStatus = "skipped";
          break; // No point running further phases if agent is stubbed
        }
        if (phaseResult.status === "error" || phaseResult.status === "timeout") {
          agentStatus = phaseResult.status;
          break;
        }
      }
    } else {
      const agentResult = runAgent(adapter, taskContent, tmpDir, effectiveAgent, timeoutMs);
      agentStatus = agentResult.status;
      transcriptPath = agentResult.transcriptPath;
    }

    // Run success criteria, passing transcript path for convention checks
    const criteria = runCriteria(scenarioName, tmpDir, transcriptPath);
    const elapsed = Date.now() - startTime;
    const duration = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;

    return {
      scenario: scenarioName,
      agent: effectiveAgent,
      lab_fork: lab || null,
      passed: criteria.passed,
      checks: criteria.checks || [],
      summary: criteria.summary || (criteria.passed ? "All checks passed" : "Some checks failed"),
      agent_status: agentStatus,
      duration,
      gym_root: SCENARIOS_DIR,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const duration = `${(elapsed / 1000).toFixed(1)}s`;
    const errMsg = err instanceof Error ? err.message : "unknown";
    return {
      scenario: scenarioName,
      agent: effectiveAgent,
      lab_fork: lab || null,
      passed: false,
      checks: [],
      summary: `Runner error: ${errMsg.slice(0, 500)}`,
      agent_status: "error",
      duration,
      gym_root: SCENARIOS_DIR,
    };
  } finally {
    if (!keepDir) {
      cleanupTempDir(tmpDir);
    } else {
      process.stderr.write(`Keeping work dir: ${tmpDir}\n`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  // List mode
  if (args.list) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    for (const name of filtered) {
      const meta = loadScenarioMeta(name);
      const tier = meta ? meta.tier : "?";
      const cats = meta && meta.categories ? meta.categories.join(",") : "";
      process.stdout.write(`${name}\t${tier}\t${cats}\n`);
    }
    process.exit(0);
  }

  // Run-all mode
  if (args.runAll) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    const results = [];
    for (const name of filtered) {
      const result = runScenario(name, args.agent, args.lab, args.adapter, args.timeout, args.keep);
      results.push(result);
      // Log progress to stderr
      const mark = result.passed ? "✓" : "✗";
      process.stderr.write(`${mark} ${name} (${result.agent_status}, ${result.duration})\n`);
    }
    // Output all results JSON array
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    const allPassed = results.every((r ) => r.passed);
    process.exit(allPassed ? 0 : 1);
  }

  // Single scenario mode
  if (!args.scenario) {
    process.stderr.write(
      "Usage: gym-runner <scenario> [--agent <name>] [--timeout <min>] [--adapter <name>]\n" +
      "       gym-runner --list [--tier <t>] [--tag <t>] [--category <c>]\n" +
      "       gym-runner --run-all [--tier <t>] [--agent <name>]\n"
    );
    process.exit(1);
  }

  const result = runScenario(args.scenario, args.agent, args.lab, args.adapter, args.timeout, args.keep);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.passed ? 0 : 1);
}

main();
