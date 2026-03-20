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

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as os from "os";
import * as crypto from "crypto";

// ── Interfaces (stripped during JS compilation) ──────────────────────

interface GymResult {
  scenario: string;
  agent: string;
  lab_fork: string | null;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
  summary: string;
  agent_status: string;
  duration: string;
  gym_root: string;
}

interface ScenarioMeta {
  name: string;
  categories: string[];
  tags: string[];
  tier: string;
  timeout: number;
  agent_type: string;
  workflow: boolean;
}

interface CriteriaOutput {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string; message?: string }>;
  summary: string;
}

// ── Path resolution ──────────────────────────────────────────────────

const SCRIPT_DIR = __dirname;
// runner.ts lives at src/gym/ — project root is 2 levels up.
// But when compiled to a temp file, __dirname may differ.
// Use GYM_PROJECT_ROOT env or walk up looking for agents/gym/scenarios.
function findProjectRoot(): string {
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

interface ParsedArgs {
  scenario: string;
  agent: string;
  lab: string;
  timeout: number;
  adapter: string;
  keep: boolean;
  list: boolean;
  runAll: boolean;
  tier: string;
  tag: string;
  category: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
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
      args.agent = rest[i] as string;
    } else if (a === "--lab" && i + 1 < rest.length) {
      i++;
      args.lab = rest[i] as string;
    } else if (a === "--timeout" && i + 1 < rest.length) {
      i++;
      args.timeout = parseInt(rest[i] as string, 10) || 5;
    } else if (a === "--adapter" && i + 1 < rest.length) {
      i++;
      args.adapter = rest[i] as string;
    } else if (a === "--tier" && i + 1 < rest.length) {
      i++;
      args.tier = rest[i] as string;
    } else if (a === "--tag" && i + 1 < rest.length) {
      i++;
      args.tag = rest[i] as string;
    } else if (a === "--category" && i + 1 < rest.length) {
      i++;
      args.category = rest[i] as string;
    } else if (!a.startsWith("--") && !args.scenario) {
      args.scenario = a;
    }
    i++;
  }
  return args;
}

// ── Scenario discovery ───────────────────────────────────────────────

function loadScenarioMeta(scenarioName: string): ScenarioMeta | null {
  const jsonPath = path.join(SCENARIOS_DIR, scenarioName, "scenario.json");
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as ScenarioMeta;
  } catch {
    return null;
  }
}

function listAllScenarios(): string[] {
  if (!fs.existsSync(SCENARIOS_DIR)) return [];
  return fs.readdirSync(SCENARIOS_DIR).filter((d: string) => {
    return fs.existsSync(path.join(SCENARIOS_DIR, d, "task.md"));
  }).sort();
}

// Tier hierarchy: smoke ⊂ standard ⊂ full
const TIER_LEVELS: Record<string, number> = { smoke: 1, standard: 2, full: 3 };

function filterScenarios(names: string[], tier: string, tag: string, category: string): string[] {
  return names.filter((name: string) => {
    const meta = loadScenarioMeta(name);
    if (!meta) return false;
    if (tier) {
      const requestedLevel = TIER_LEVELS[tier] || 3;
      const scenarioLevel = TIER_LEVELS[meta.tier] || 3;
      // A tier filter includes all scenarios AT or BELOW that tier level
      if (scenarioLevel > requestedLevel) return false;
    }
    if (tag && !meta.tags.includes(tag)) return false;
    if (category && !meta.categories.includes(category)) return false;
    return true;
  });
}

// ── Temp dir management ──────────────────────────────────────────────

function createTempDir(scenarioName: string): string {
  const id = crypto.randomBytes(4).toString("hex");
  const tmpDir = path.join(os.tmpdir(), `gym-${scenarioName}-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function copyEnvironment(scenarioName: string, destDir: string): void {
  const envDir = path.join(SCENARIOS_DIR, scenarioName, "environment");
  if (!fs.existsSync(envDir)) return;
  // Use cp -r for reliable recursive copy (node 18 has fs.cpSync)
  try {
    fs.cpSync(envDir, destDir, { recursive: true });
  } catch {
    // Fallback to shell cp
    execSync(`cp -r "${envDir}/." "${destDir}/"`, { stdio: "pipe" });
  }
}

function cleanupTempDir(tmpDir: string): void {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// ── Agent adapters ───────────────────────────────────────────────────

function runAgent(adapter: string, taskContent: string, workDir: string, agent: string, timeoutMs: number): string {
  // Write task to work dir for reference
  fs.writeFileSync(path.join(workDir, "_gym_task.md"), taskContent);

  if (adapter === "generic") {
    const cmd = process.env["GYM_AGENT_CMD"];
    if (!cmd) {
      return "skipped";
    }
    try {
      execSync(`${cmd} "${path.join(workDir, "_gym_task.md")}" "${workDir}"`, {
        cwd: workDir,
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf-8",
      });
      return "completed";
    } catch (err: unknown) {
      return "error";
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
    return "skipped";
  }

  // Real agent binary found via GYM_AGENT_BIN — invoke it
  try {
    execSync(
      `"${agentBin}" --oneshot --agent "${agent}" --task-file "${path.join(workDir, "_gym_task.md")}" --work-dir "${workDir}"`,
      {
        cwd: workDir,
        timeout: timeoutMs,
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, GYM_WORK_DIR: workDir },
      }
    );
    return "completed";
  } catch (err: unknown) {
    // Agent may exit non-zero but still have done work
    const errObj = Object(err);
    if (errObj.status !== undefined) {
      return "error";
    }
    return "timeout";
  }
}

// ── Scoring ──────────────────────────────────────────────────────────

function runCriteria(scenarioName: string, workDir: string): CriteriaOutput {
  const criteriaPath = path.join(SCENARIOS_DIR, scenarioName, "success_criteria.js");
  if (!fs.existsSync(criteriaPath)) {
    return {
      passed: false,
      checks: [{ name: "criteria-exists", passed: false, detail: "success_criteria.js not found" }],
      summary: "No success_criteria.js found for scenario",
    };
  }

  try {
    const stdout = execSync(`node "${criteriaPath}" "${workDir}"`, {
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
    const parsed = JSON.parse(jsonMatch[0]) as CriteriaOutput;
    // Normalize checks: ensure message field exists (criteria may use "detail" instead)
    if (parsed.checks) {
      parsed.checks = parsed.checks.map((c: any) => ({
        name: c.name,
        passed: c.passed,
        message: c.message || c.detail || undefined,
      }));
    }
    return parsed;
  } catch (err: unknown) {
    // Criteria may exit non-zero but still output JSON
    const errObj = Object(err);
    const stdout = (errObj.stdout || "").toString();
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as CriteriaOutput;
        if (parsed.checks) {
          parsed.checks = parsed.checks.map((c: any) => ({
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

function runScenario(scenarioName: string, agent: string, lab: string, adapter: string, timeoutMinutes: number, keepDir: boolean): GymResult {
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

    let agentStatus: string;

    if (meta.workflow) {
      // Workflow: split task on --- delimiter, run phases sequentially
      const phases = taskContent.split(/\n---\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      agentStatus = "completed";
      for (let pi = 0; pi < phases.length; pi++) {
        const phaseTask = phases[pi] as string;
        const phaseStatus = runAgent(adapter, phaseTask, tmpDir, agent, timeoutMs);
        if (phaseStatus === "skipped") {
          agentStatus = "skipped";
          break; // No point running further phases if agent is stubbed
        }
        if (phaseStatus === "error" || phaseStatus === "timeout") {
          agentStatus = phaseStatus;
          break;
        }
      }
    } else {
      agentStatus = runAgent(adapter, taskContent, tmpDir, agent, timeoutMs);
    }

    // Run success criteria
    const criteria = runCriteria(scenarioName, tmpDir);
    const elapsed = Date.now() - startTime;
    const duration = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;

    return {
      scenario: scenarioName,
      agent,
      lab_fork: lab || null,
      passed: criteria.passed,
      checks: criteria.checks || [],
      summary: criteria.summary || (criteria.passed ? "All checks passed" : "Some checks failed"),
      agent_status: agentStatus,
      duration,
      gym_root: SCENARIOS_DIR,
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;
    const duration = `${(elapsed / 1000).toFixed(1)}s`;
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

function main(): void {
  const args = parseArgs(process.argv);

  // List mode
  if (args.list) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    for (const name of filtered) {
      const meta = loadScenarioMeta(name);
      const tier = meta ? meta.tier : "?";
      const cats = meta ? meta.categories.join(",") : "";
      process.stdout.write(`${name}\t${tier}\t${cats}\n`);
    }
    process.exit(0);
  }

  // Run-all mode
  if (args.runAll) {
    const all = listAllScenarios();
    const filtered = filterScenarios(all, args.tier, args.tag, args.category);
    const results: GymResult[] = [];
    for (const name of filtered) {
      const result = runScenario(name, args.agent, args.lab, args.adapter, args.timeout, args.keep);
      results.push(result);
      // Log progress to stderr
      const mark = result.passed ? "✓" : "✗";
      process.stderr.write(`${mark} ${name} (${result.agent_status}, ${result.duration})\n`);
    }
    // Output all results as a JSON array
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    const allPassed = results.every((r: GymResult) => r.passed);
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
