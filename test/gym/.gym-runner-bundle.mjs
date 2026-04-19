// agents/src/gym/runner.ts
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as os from "os";
import * as crypto from "crypto";
import { fileURLToPath } from "url";
var __filename_esm = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
var __dirname_esm = typeof __dirname !== "undefined" ? __dirname : path.dirname(__filename_esm);
var SCRIPT_DIR = __dirname_esm;
function findProjectRoot() {
  const envRoot = process.env["GYM_PROJECT_ROOT"];
  if (envRoot && fs.existsSync(path.join(envRoot, "agents", "gym", "scenarios"))) {
    return envRoot;
  }
  let dir = SCRIPT_DIR;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "agents", "gym", "scenarios"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fs.existsSync(path.join(process.cwd(), "agents", "gym", "scenarios"))) {
    return process.cwd();
  }
  const errorResult = {
    scenario: "",
    agent: "",
    lab_fork: null,
    passed: false,
    checks: [],
    summary: "Cannot find project root (agents/gym/scenarios not found)",
    agent_status: "error",
    duration: "0s",
    gym_root: ""
  };
  process.stdout.write(JSON.stringify(errorResult, null, 2) + "\n");
  process.stderr.write("ERROR: Cannot find project root (agents/gym/scenarios not found)\n");
  process.exit(1);
}
var PROJECT_ROOT = findProjectRoot();
var SCENARIOS_DIR = path.join(PROJECT_ROOT, "agents", "gym", "scenarios");
function parseArgs(argv) {
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
    category: ""
  };
  const rest = argv.slice(2);
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
function loadScenarioMeta(scenarioName) {
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
var TIER_LEVELS = { smoke: 1, standard: 2, full: 3 };
function filterScenarios(names, tier, tag, category) {
  return names.filter((name) => {
    const meta = loadScenarioMeta(name);
    if (!meta) return false;
    if (tier) {
      const requestedLevel = TIER_LEVELS[tier] || 3;
      const scenarioLevel = TIER_LEVELS[meta.tier] || 3;
      if (scenarioLevel > requestedLevel) return false;
    }
    if (tag && !(meta.tags || []).includes(tag)) return false;
    if (category && !(meta.categories || []).includes(category)) return false;
    return true;
  });
}
function createTempDir(scenarioName) {
  const id = crypto.randomBytes(4).toString("hex");
  const tmpDir = path.join(os.tmpdir(), `gym-${scenarioName}-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}
function copyEnvironment(scenarioName, destDir) {
  const envDir = path.join(SCENARIOS_DIR, scenarioName, "environment");
  if (!fs.existsSync(envDir)) return;
  const taskPath = path.join(SCENARIOS_DIR, scenarioName, "task.md");
  const criteriaPath = path.join(SCENARIOS_DIR, scenarioName, "success_criteria.js");
  let preserveEnvDir = false;
  try {
    const taskContent = fs.existsSync(taskPath) ? fs.readFileSync(taskPath, "utf-8") : "";
    const criteriaContent = fs.existsSync(criteriaPath) ? fs.readFileSync(criteriaPath, "utf-8") : "";
    if (criteriaContent.includes('"environment/') || criteriaContent.includes("'environment/")) {
      preserveEnvDir = true;
    }
  } catch {
  }
  const targetDir = preserveEnvDir ? path.join(destDir, "environment") : destDir;
  if (preserveEnvDir) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  try {
    fs.cpSync(envDir, targetDir, { recursive: true });
  } catch {
    execSync(`cp -r "${envDir}/." "${targetDir}/"`, { stdio: "pipe" });
  }
}
function cleanupTempDir(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
  }
}
function snapshotDir(dir) {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function syncNewFilesFromRoot(beforeSnapshot, workDir) {
  const after = snapshotDir(PROJECT_ROOT);
  for (const file of after) {
    if (!beforeSnapshot.has(file) && !file.startsWith(".") && !file.startsWith("_")) {
      const srcPath = path.join(PROJECT_ROOT, file);
      const destPath = path.join(workDir, file);
      try {
        const stat = fs.statSync(srcPath);
        if (stat.isFile() && stat.size < 1024 * 1024) {
          fs.copyFileSync(srcPath, destPath);
          fs.unlinkSync(srcPath);
        } else if (stat.isDirectory()) {
          try {
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
          } catch {
          }
        }
      } catch {
      }
    }
  }
}
function runAgent(adapter, taskContent, workDir, agent, timeoutMs) {
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
        encoding: "utf-8"
      });
      const transcriptPath2 = path.join(workDir, "_transcript.txt");
      fs.writeFileSync(transcriptPath2, stdout || "");
      return { status: "completed", transcriptPath: transcriptPath2 };
    } catch (err) {
      return { status: "error" };
    }
  }
  const agentBin = process.env["GYM_AGENT_BIN"] || "";
  if (!agentBin || !fs.existsSync(agentBin)) {
    fs.writeFileSync(
      path.join(workDir, "_gym_agent_stub.log"),
      `No agent binary found (GYM_AGENT_BIN not set or not found).
Task written to _gym_task.md.
Stub mode \u2014 scenario scoring will run against unmodified environment.
`
    );
    return { status: "skipped" };
  }
  const beforeSnapshot = snapshotDir(PROJECT_ROOT);
  const taskFile = path.join(workDir, "_gym_task.md");
  let agentStdout = "";
  try {
    agentStdout = execSync(
      `"${agentBin}" --oneshot --agent "${agent}" --task-file "${taskFile}" --work-dir "${workDir}"`,
      {
        cwd: workDir,
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, GYM_WORK_DIR: workDir }
      }
    ) || "";
  } catch (err) {
    const errObj = Object(err);
    agentStdout = (errObj.stdout || "").toString();
    if (errObj.killed) {
      const transcriptPath3 = path.join(workDir, "_transcript.txt");
      fs.writeFileSync(transcriptPath3, agentStdout);
      syncNewFilesFromRoot(beforeSnapshot, workDir);
      return { status: "timeout", transcriptPath: transcriptPath3 };
    }
    const transcriptPath2 = path.join(workDir, "_transcript.txt");
    fs.writeFileSync(transcriptPath2, agentStdout);
    syncNewFilesFromRoot(beforeSnapshot, workDir);
    return { status: "error", transcriptPath: transcriptPath2 };
  }
  const transcriptPath = path.join(workDir, "_transcript.txt");
  fs.writeFileSync(transcriptPath, agentStdout);
  syncNewFilesFromRoot(beforeSnapshot, workDir);
  try {
    const sessionsDir = path.join(PROJECT_ROOT, ".state", "sessions");
    if (fs.existsSync(sessionsDir)) {
      const sessionDirs = fs.readdirSync(sessionsDir).filter((d) => d.startsWith("s_")).sort().reverse();
      if (sessionDirs.length > 0) {
        const latestSession = sessionDirs[0];
        const jsonlPath = path.join(sessionsDir, latestSession, "session.jsonl");
        if (fs.existsSync(jsonlPath)) {
          const sessionData = fs.readFileSync(jsonlPath, "utf-8");
          fs.appendFileSync(transcriptPath, "\n--- SESSION JSONL ---\n" + sessionData);
          fs.writeFileSync(path.join(workDir, "transcript.jsonl"), sessionData);
        }
      }
    }
  } catch {
  }
  return { status: "completed", transcriptPath };
}
function runCriteria(scenarioName, workDir, transcriptPath) {
  const criteriaPath = path.join(SCENARIOS_DIR, scenarioName, "success_criteria.js");
  if (!fs.existsSync(criteriaPath)) {
    return {
      passed: false,
      checks: [{ name: "criteria-exists", passed: false, detail: "success_criteria.js not found" }],
      summary: "No success_criteria.js found for scenario"
    };
  }
  const transcriptArg = transcriptPath && fs.existsSync(transcriptPath) ? ` "${transcriptPath}"` : "";
  const cmd = `node "${criteriaPath}" "${workDir}"${transcriptArg}`;
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 3e4,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.join(SCENARIOS_DIR, scenarioName)
    });
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (!jsonMatch) {
      return {
        passed: false,
        checks: [{ name: "criteria-parse", passed: false, detail: "No JSON in criteria output" }],
        summary: "success_criteria.js produced no JSON output"
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.checks) {
      parsed.checks = parsed.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        message: c.message || c.detail || void 0
      }));
    }
    return parsed;
  } catch (err) {
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
            message: c.message || c.detail || void 0
          }));
        }
        return parsed;
      } catch {
      }
    }
    return {
      passed: false,
      checks: [{ name: "criteria-run", passed: false, message: `Criteria error: ${(errObj.message || "").slice(0, 500)}` }],
      summary: `success_criteria.js failed: ${(errObj.message || "").slice(0, 200)}`
    };
  }
}
function runScenario(scenarioName, agent, lab, adapter, timeoutMinutes, keepDir) {
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
      gym_root: SCENARIOS_DIR
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
      gym_root: SCENARIOS_DIR
    };
  }
  const taskContent = fs.readFileSync(taskPath, "utf-8");
  const timeoutMs = (timeoutMinutes || meta.timeout || 5) * 60 * 1e3;
  const tmpDir = createTempDir(scenarioName);
  try {
    copyEnvironment(scenarioName, tmpDir);
    let agentStatus;
    let transcriptPath;
    if (meta.workflow) {
      const phases = taskContent.split(/\n---\n/).map((p) => p.trim()).filter((p) => p.length > 0);
      agentStatus = "completed";
      for (let pi = 0; pi < phases.length; pi++) {
        const phaseTask = phases[pi];
        const phaseResult = runAgent(adapter, phaseTask, tmpDir, agent, timeoutMs);
        transcriptPath = phaseResult.transcriptPath || transcriptPath;
        if (phaseResult.status === "skipped") {
          agentStatus = "skipped";
          break;
        }
        if (phaseResult.status === "error" || phaseResult.status === "timeout") {
          agentStatus = phaseResult.status;
          break;
        }
      }
    } else {
      const agentResult = runAgent(adapter, taskContent, tmpDir, agent, timeoutMs);
      agentStatus = agentResult.status;
      transcriptPath = agentResult.transcriptPath;
    }
    const criteria = runCriteria(scenarioName, tmpDir, transcriptPath);
    const elapsed = Date.now() - startTime;
    const duration = elapsed < 1e3 ? `${elapsed}ms` : `${(elapsed / 1e3).toFixed(1)}s`;
    return {
      scenario: scenarioName,
      agent,
      lab_fork: lab || null,
      passed: criteria.passed,
      checks: criteria.checks || [],
      summary: criteria.summary || (criteria.passed ? "All checks passed" : "Some checks failed"),
      agent_status: agentStatus,
      duration,
      gym_root: SCENARIOS_DIR
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const duration = `${(elapsed / 1e3).toFixed(1)}s`;
    const errMsg = err instanceof Error ? err.message : "unknown";
    return {
      scenario: scenarioName,
      agent,
      lab_fork: lab || null,
      passed: false,
      checks: [],
      summary: `Runner error: ${errMsg.slice(0, 500)}`,
      agent_status: "error",
      duration,
      gym_root: SCENARIOS_DIR
    };
  } finally {
    if (!keepDir) {
      cleanupTempDir(tmpDir);
    } else {
      process.stderr.write(`Keeping work dir: ${tmpDir}
`);
    }
  }
}
function main() {
  const args = parseArgs(process.argv);
  if (args.list) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    for (const name of filtered) {
      const meta = loadScenarioMeta(name);
      const tier = meta ? meta.tier : "?";
      const cats = meta && meta.categories ? meta.categories.join(",") : "";
      process.stdout.write(`${name}	${tier}	${cats}
`);
    }
    process.exit(0);
  }
  if (args.runAll) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    const results = [];
    for (const name of filtered) {
      const result2 = runScenario(name, args.agent, args.lab, args.adapter, args.timeout, args.keep);
      results.push(result2);
      const mark = result2.passed ? "\u2713" : "\u2717";
      process.stderr.write(`${mark} ${name} (${result2.agent_status}, ${result2.duration})
`);
    }
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    const allPassed = results.every((r) => r.passed);
    process.exit(allPassed ? 0 : 1);
  }
  if (!args.scenario) {
    process.stderr.write(
      "Usage: gym-runner <scenario> [--agent <name>] [--timeout <min>] [--adapter <name>]\n       gym-runner --list [--tier <t>] [--tag <t>] [--category <c>]\n       gym-runner --run-all [--tier <t>] [--agent <name>]\n"
    );
    process.exit(1);
  }
  const result = runScenario(args.scenario, args.agent, args.lab, args.adapter, args.timeout, args.keep);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.passed ? 0 : 1);
}
main();
