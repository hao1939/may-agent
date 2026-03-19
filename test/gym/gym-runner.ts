/**
 * gym-runner.ts — Decoupled gym scenario runner.
 *
 * Runs an agent against a gym scenario and scores the result.
 * Uses adapters to invoke different agent runtimes (may-agent, claude-code, generic).
 *
 * Usage:
 *   bun test/gym/gym-runner.ts <scenario> [options]
 *   bun test/gym/gym-runner.ts --list [--tier <t>] [--category <c>] [--tag <t>]
 *   bun test/gym/gym-runner.ts --run-all [--tier <t>] [--category <c>] [--tag <t>]
 *
 * Options:
 *   --adapter <name>      may-agent (default), claude-code, generic
 *   --agent <name>        Agent name passed to adapter (default: coder)
 *   --lab <fork>          Lab fork name (may-agent adapter only)
 *   --timeout <min>       Override timeout in minutes
 *   --tier <tier>         Filter: smoke, standard, full
 *   --category <cat>      Filter: bug-fixing, integrity, judgment, etc.
 *   --tag <tag>           Filter: ability, behavior, workflow
 *   --list                List matching scenarios
 *   --run-all             Run all matching scenarios sequentially
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

interface ScenarioMeta {
  name: string;
  categories: string[];
  tags: string[];
  tier: "smoke" | "standard" | "full";
  timeout: number;
  agent_type: string;
  workflow: boolean;
}

interface ScoreCheck {
  name: string;
  passed: boolean;
  detail: string;
}

interface ScoreResult {
  passed: boolean;
  checks: ScoreCheck[];
  summary: string;
}

interface RunResult {
  scenario: string;
  adapter: string;
  agent: string;
  lab_fork: string | null;
  workflow: boolean;
  passed: boolean;
  checks: ScoreCheck[];
  summary: string;
  agent_status: string;
  duration_ms: number;
  session_id: string;
  session_path: string;
  work_dir: string;
  gym_root: string;
}

interface AdapterResult {
  sessionId: string;
  status: string;
  sessionPath: string;
}

interface Adapter {
  name: string;
  setup(projectRoot: string, opts: AdapterOpts): void;
  runAgent(taskFile: string, workDir: string, timeoutMin: number): AdapterResult;
}

interface AdapterOpts {
  agentName: string;
  labFork: string;
  gymRoot: string;
}

// ── Paths ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const SCENARIOS_DIR = join(PROJECT_ROOT, "test/gym/scenarios");

// ── Adapter: may-agent ─────────────────────────────────────────────────

function createMayAgentAdapter(): Adapter {
  let mayCmd: string[] = [];
  let agentsRoot = "";
  let agentName = "";
  let gymRoot = "";

  return {
    name: "may-agent",

    setup(projectRoot: string, opts: AdapterOpts) {
      agentName = opts.agentName;
      gymRoot = opts.gymRoot;

      // Resolve agents root (with optional lab fork overlay)
      if (opts.labFork) {
        const labDir = join(projectRoot, "agents/.lab", opts.labFork);
        if (!existsSync(labDir)) throw new Error(`Lab fork not found: ${labDir}`);
        const gymAgents = join(opts.gymRoot, "agents-lab");
        cpSync(join(projectRoot, "agents"), gymAgents, { recursive: true });
        rmSync(join(gymAgents, ".lab"), { recursive: true, force: true });
        rmSync(join(gymAgents, ".git"), { recursive: true, force: true });
        cpSync(labDir, join(gymAgents, opts.agentName), { recursive: true });
        agentsRoot = gymAgents;
      } else {
        agentsRoot = join(projectRoot, "agents");
      }

      // Verify agent exists
      if (!existsSync(join(agentsRoot, opts.agentName, "agent.json"))) {
        throw new Error(`Agent '${opts.agentName}' not found in: ${agentsRoot}`);
      }

      // Resolve binary (with staleness check)
      const envBin = process.env["MAY_BIN"];
      if (envBin) {
        mayCmd = [envBin];
      } else {
        const binary = join(projectRoot, "bundle/may-agent");
        if (existsSync(binary)) {
          let stale = false;
          try {
            const binaryStat = statSync(binary);
            const newerFile = findNewerFile(join(projectRoot, "src"), binaryStat.mtimeMs);
            stale = newerFile !== null;
          } catch { /* assume fresh */ }

          if (stale) {
            console.error("Warning: compiled binary is stale. Using bun.");
            mayCmd = ["bun", join(projectRoot, "src/app/may.ts")];
          } else {
            mayCmd = [binary];
          }
        } else {
          mayCmd = ["bun", join(projectRoot, "src/app/may.ts")];
        }
      }
    },

    runAgent(taskFile: string, _workDir: string, timeoutMin: number): AdapterResult {
      const gymState = join(gymRoot, "state");
      mkdirSync(gymState, { recursive: true });

      const cmdParts = mayCmd.map(s => `"${s}"`).join(" ");
      const fullCmd = `${cmdParts} --oneshot --agent "${agentName}" --task-file "${taskFile}" --timeout=${timeoutMin}`;

      try {
        const stdout = execSync(fullCmd, {
          env: {
            ...process.env,
            AGENTS_ROOT: agentsRoot,
            STATE_DIR: gymState,
          },
          timeout: timeoutMin * 60 * 1000 + 30000, // extra 30s grace
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
        });

        return parseOneshotOutput(stdout, gymState);
      } catch (err: unknown) {
        const e = err as { stdout?: string };
        if (e.stdout) {
          const parsed = parseOneshotOutput(e.stdout, gymState);
          if (parsed.sessionId) return parsed;
        }
        return { sessionId: "", status: "error", sessionPath: "" };
      }
    },
  };
}

function parseOneshotOutput(stdout: string, gymState: string): AdapterResult {
  try {
    const parsed = JSON.parse(stdout.trim());
    const sessionId: string = parsed.sessionId || "";
    const status: string = parsed.status || "unknown";

    let sessionPath = "";
    if (sessionId) {
      for (const candidate of [
        join(gymState, "sessions", sessionId),
        join(gymState, "sessions/history", sessionId),
      ]) {
        if (existsSync(candidate)) {
          sessionPath = candidate;
          break;
        }
      }
    }

    return { sessionId, status, sessionPath };
  } catch {
    return { sessionId: "", status: "unknown", sessionPath: "" };
  }
}

// ── Adapter: claude-code ───────────────────────────────────────────────

function createClaudeCodeAdapter(): Adapter {
  return {
    name: "claude-code",

    setup() {
      try {
        execSync("which claude", { stdio: "pipe" });
      } catch {
        throw new Error("claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code");
      }
    },

    runAgent(taskFile: string, workDir: string, timeoutMin: number): AdapterResult {
      const task = readFileSync(taskFile, "utf-8");
      const timeoutMs = timeoutMin * 60 * 1000;

      try {
        execSync(
          `claude -p ${JSON.stringify(task)} --dangerously-skip-permissions --output-format json --max-turns 50`,
          {
            cwd: workDir,
            timeout: timeoutMs,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            maxBuffer: 10 * 1024 * 1024,
          }
        );
        return { sessionId: "", status: "success", sessionPath: "" };
      } catch (err: unknown) {
        const e = err as { killed?: boolean; signal?: string };
        const status = (e.killed || e.signal === "SIGTERM") ? "timeout" : "error";
        return { sessionId: "", status, sessionPath: "" };
      }
    },
  };
}

// ── Adapter: generic ───────────────────────────────────────────────────

function createGenericAdapter(): Adapter {
  let agentCmd = "";

  return {
    name: "generic",

    setup() {
      agentCmd = process.env["GYM_AGENT_CMD"] || "";
      if (!agentCmd) {
        throw new Error(
          "GYM_AGENT_CMD env var required for generic adapter.\n" +
          "Example: GYM_AGENT_CMD='my-agent --task-file' bun test/gym/gym-runner.ts phantom-fix --adapter generic"
        );
      }
    },

    runAgent(taskFile: string, workDir: string, timeoutMin: number): AdapterResult {
      const timeoutMs = timeoutMin * 60 * 1000;

      try {
        execSync(`${agentCmd} "${taskFile}"`, {
          cwd: workDir,
          timeout: timeoutMs,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
        });
        return { sessionId: "", status: "success", sessionPath: "" };
      } catch (err: unknown) {
        const e = err as { killed?: boolean; signal?: string };
        const status = (e.killed || e.signal === "SIGTERM") ? "timeout" : "error";
        return { sessionId: "", status, sessionPath: "" };
      }
    },
  };
}

// ── Adapter registry ───────────────────────────────────────────────────

const ADAPTERS: Record<string, () => Adapter> = {
  "may-agent": createMayAgentAdapter,
  "claude-code": createClaudeCodeAdapter,
  "generic": createGenericAdapter,
};

// ── Scenario loading ───────────────────────────────────────────────────

function loadScenarioMeta(scenarioDir: string): ScenarioMeta | null {
  const metaPath = join(scenarioDir, "scenario.json");
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

function listScenarios(): string[] {
  return readdirSync(SCENARIOS_DIR)
    .filter(name => {
      const dir = join(SCENARIOS_DIR, name);
      return existsSync(join(dir, "task.md")) &&
             existsSync(join(dir, "success_criteria.js")) &&
             existsSync(join(dir, "environment"));
    })
    .sort();
}

function matchesFilters(
  meta: ScenarioMeta | null,
  tier?: string,
  category?: string,
  tag?: string,
): boolean {
  if (!tier && !category && !tag) return true;
  if (!meta) return false;

  if (tier) {
    // Tier hierarchy: smoke < standard < full
    switch (tier) {
      case "smoke":
        if (meta.tier !== "smoke") return false;
        break;
      case "standard":
        if (meta.tier !== "smoke" && meta.tier !== "standard") return false;
        break;
      case "full":
        break; // everything matches
      default:
        if (meta.tier !== tier) return false;
    }
  }

  if (category && !meta.categories.includes(category)) return false;
  if (tag && !meta.tags.includes(tag)) return false;

  return true;
}

// ── Scoring ────────────────────────────────────────────────────────────

function scoreScenario(scenarioDir: string, workDir: string): ScoreResult {
  const criteriaPath = join(scenarioDir, "success_criteria.js");
  try {
    const output = execSync(`node "${criteriaPath}" "${workDir}"`, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(output.trim());
  } catch {
    return { passed: false, checks: [], summary: "scoring failed" };
  }
}

// ── Single scenario run ────────────────────────────────────────────────

function runScenario(
  scenarioName: string,
  adapter: Adapter,
  agentName: string,
  labFork: string,
  timeoutOverride?: number,
): RunResult {
  const scenarioDir = join(SCENARIOS_DIR, scenarioName);

  // Validate
  for (const required of ["task.md", "success_criteria.js", "environment"]) {
    if (!existsSync(join(scenarioDir, required))) {
      throw new Error(`Missing: ${join(scenarioDir, required)}`);
    }
  }

  const meta = loadScenarioMeta(scenarioDir);
  const isWorkflow = meta?.workflow ?? false;
  const timeout = timeoutOverride ?? meta?.timeout ?? 5;

  // Set up isolated environment
  const gymRoot = mkdtempSync(join(tmpdir(), "gym-run-"));
  const workDir = join(gymRoot, "work");
  const stateDir = join(gymRoot, "state");
  mkdirSync(workDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });

  // Copy environment
  cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });

  // Setup adapter
  adapter.setup(PROJECT_ROOT, { agentName, labFork, gymRoot });

  const startMs = Date.now();
  let lastResult: AdapterResult = { sessionId: "", status: "unknown", sessionPath: "" };

  if (isWorkflow) {
    // Multi-phase: split task.md on "---"
    const fullTask = readFileSync(join(scenarioDir, "task.md"), "utf-8");
    const parts = fullTask.split(/^---$/m);

    for (let i = 0; i < parts.length; i++) {
      const phase = parts[i].trim();
      if (!phase) continue;

      const phaseFile = join(gymRoot, `phase${i + 1}-task.md`);
      writeFileSync(phaseFile, `Work in this directory: ${workDir}\n\n${phase}\n`);

      console.error(`Phase ${i + 1}...`);
      lastResult = adapter.runAgent(phaseFile, workDir, timeout);
      console.error(`Phase ${i + 1} complete (session: ${lastResult.sessionId})`);
    }
  } else {
    // Single phase
    const taskFile = join(gymRoot, "task.md");
    const taskContent = readFileSync(join(scenarioDir, "task.md"), "utf-8");
    writeFileSync(taskFile, `Work in this directory: ${workDir}\n\n${taskContent}\n`);

    lastResult = adapter.runAgent(taskFile, workDir, timeout);
  }

  const durationMs = Date.now() - startMs;

  // Score
  const score = scoreScenario(scenarioDir, workDir);

  return {
    scenario: scenarioName,
    adapter: adapter.name,
    agent: agentName,
    lab_fork: labFork || null,
    workflow: isWorkflow,
    passed: score.passed,
    checks: score.checks,
    summary: score.summary,
    agent_status: lastResult.status,
    duration_ms: durationMs,
    session_id: lastResult.sessionId,
    session_path: lastResult.sessionPath,
    work_dir: workDir,
    gym_root: gymRoot,
  };
}

// ── Utilities ──────────────────────────────────────────────────────────

function findNewerFile(dir: string, thanMs: number): string | null {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findNewerFile(full, thanMs);
        if (found) return found;
      } else if (entry.name.endsWith(".ts")) {
        if (statSync(full).mtimeMs > thanMs) return full;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── CLI ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = {
    scenario: "",
    adapter: "may-agent",
    agent: "coder",
    lab: "",
    timeout: undefined as number | undefined,
    tier: "",
    category: "",
    tag: "",
    list: false,
    runAll: false,
  };

  let i = 2; // skip bun and script path
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--adapter":   args.adapter = argv[++i]; break;
      case "--agent":     args.agent = argv[++i]; break;
      case "--lab":       args.lab = argv[++i]; break;
      case "--timeout":   args.timeout = parseInt(argv[++i]); break;
      case "--tier":      args.tier = argv[++i]; break;
      case "--category":  args.category = argv[++i]; break;
      case "--tag":       args.tag = argv[++i]; break;
      case "--list":      args.list = true; break;
      case "--run-all":   args.runAll = true; break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown flag: ${arg}`);
          process.exit(1);
        }
        args.scenario = arg;
    }
    i++;
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);

  // ── List mode ────────────────────────────────────────────────────
  if (args.list) {
    const scenarios = listScenarios();
    for (const name of scenarios) {
      const meta = loadScenarioMeta(join(SCENARIOS_DIR, name));
      if (!matchesFilters(meta, args.tier, args.category, args.tag)) continue;

      if (meta) {
        const cats = meta.categories.join(",");
        console.log(`${name.padEnd(42)} tier=${meta.tier.padEnd(10)} categories=${cats}`);
      } else {
        console.log(`${name.padEnd(42)} (no metadata)`);
      }
    }
    return;
  }

  // ── Run-all mode ─────────────────────────────────────────────────
  if (args.runAll) {
    const scenarios = listScenarios().filter(name => {
      const meta = loadScenarioMeta(join(SCENARIOS_DIR, name));
      return matchesFilters(meta, args.tier, args.category, args.tag);
    });

    if (scenarios.length === 0) {
      console.error("No scenarios match filters.");
      process.exit(1);
    }

    console.error(`Running ${scenarios.length} scenarios...`);
    const results: RunResult[] = [];
    let passCount = 0;

    for (const name of scenarios) {
      console.error(`── ${name} ──`);
      try {
        const adapterFactory = ADAPTERS[args.adapter];
        if (!adapterFactory) {
          console.error(`Unknown adapter: ${args.adapter}`);
          process.exit(1);
        }
        const adapter = adapterFactory();
        const result = runScenario(name, adapter, args.agent, args.lab, args.timeout);
        results.push(result);
        if (result.passed) {
          passCount++;
          console.error("  PASS");
        } else {
          console.error("  FAIL");
        }
      } catch (err) {
        console.error(`  ERROR: ${err}`);
        results.push({
          scenario: name,
          adapter: args.adapter,
          agent: args.agent,
          lab_fork: args.lab || null,
          workflow: false,
          passed: false,
          checks: [],
          summary: `Error: ${err}`,
          agent_status: "error",
          duration_ms: 0,
          session_id: "",
          session_path: "",
          work_dir: "",
          gym_root: "",
        });
      }
    }

    const total = scenarios.length;
    const pct = total > 0 ? Math.round(passCount * 100 / total) : 0;
    console.error(`\nResults: ${passCount}/${total} passed (${pct}%)`);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // ── Single scenario ──────────────────────────────────────────────
  if (!args.scenario) {
    console.error("Usage:");
    console.error("  bun test/gym/gym-runner.ts <scenario> [options]");
    console.error("  bun test/gym/gym-runner.ts --list [--tier <t>] [--category <c>] [--tag <t>]");
    console.error("  bun test/gym/gym-runner.ts --run-all [--tier <t>] [--category <c>]");
    console.error("");
    console.error("Adapters: may-agent (default), claude-code, generic");
    console.error("");
    console.error("Available scenarios:");
    for (const name of listScenarios()) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }

  const adapterFactory = ADAPTERS[args.adapter];
  if (!adapterFactory) {
    console.error(`Unknown adapter: ${args.adapter}. Available: ${Object.keys(ADAPTERS).join(", ")}`);
    process.exit(1);
  }

  const adapter = adapterFactory();
  const result = runScenario(args.scenario, adapter, args.agent, args.lab, args.timeout);
  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) process.exit(1);
}

main();
