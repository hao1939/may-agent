/**
 * gym-runner.ts — Decoupled gym scenario runner.
 *
 * Runs an agent against a gym scenario and scores the result.
 * Uses adapters to invoke different agent runtimes (may-agent, claude-code, generic).
 *
 * Usage:
 *   test/gym/run-gym.sh <scenario> [options]
 *   test/gym/run-gym.sh --list [--tier <t>] [--category <c>] [--tag <t>]
 *   test/gym/run-gym.sh --run-all [--tier <t>] [--category <c>] [--tag <t>]
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
  category?: string;
  code?: string;
}

interface Judgment {
  convention: string;
  name: string;
  verdict: "pass" | "fail" | "partial";
  evidence: string;
  note: string;
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
  judgments: Judgment[];
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
            console.error("Warning: compiled binary is stale. Using vite-node.");
            mayCmd = [join(projectRoot, "node_modules/.bin/vite-node"), join(projectRoot, "src/app/may.ts")];
          } else {
            mayCmd = [binary];
          }
        } else {
          mayCmd = [join(projectRoot, "node_modules/.bin/vite-node"), join(projectRoot, "src/app/may.ts")];
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

// ── Transcript Export ──────────────────────────────────────────────────

/**
 * Copy session transcript JSONL to workDir/transcript.jsonl so that
 * success_criteria.js scorers can inspect agent behavior.
 *
 * Looks for *.jsonl in the session path. If the session path is empty
 * or no JSONL file is found, writes a minimal stub explaining why.
 */
function exportTranscript(sessionPath: string, workDir: string): void {
  const transcriptDest = join(workDir, "transcript.jsonl");

  if (!sessionPath || !existsSync(sessionPath)) {
    writeFileSync(transcriptDest, JSON.stringify({ note: "no session transcript available" }) + "\n");
    return;
  }

  // Session dirs typically contain a single .jsonl transcript file
  // or the session path IS the jsonl file
  if (sessionPath.endsWith(".jsonl") && existsSync(sessionPath)) {
    cpSync(sessionPath, transcriptDest);
    return;
  }

  // Look for .jsonl files in the session directory
  try {
    const files = readdirSync(sessionPath).filter((f) => f.endsWith(".jsonl"));
    if (files.length > 0) {
      // Use the largest JSONL file (most complete transcript)
      let best = files[0];
      let bestSize = 0;
      for (const f of files) {
        const sz = statSync(join(sessionPath, f)).size;
        if (sz > bestSize) {
          bestSize = sz;
          best = f;
        }
      }
      cpSync(join(sessionPath, best), transcriptDest);
      return;
    }
  } catch {
    // fall through
  }

  // Fallback: look for messages.json or similar
  for (const candidate of ["messages.json", "messages.jsonl", "transcript.json"]) {
    const p = join(sessionPath, candidate);
    if (existsSync(p)) {
      cpSync(p, transcriptDest);
      return;
    }
  }

  writeFileSync(
    transcriptDest,
    JSON.stringify({ note: "session path found but no transcript file detected", sessionPath }) + "\n"
  );
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

// ── LLM Judge ──────────────────────────────────────────────────────────

/**
 * Run the judge agent to evaluate convention compliance.
 *
 * The judge agent reads the transcript + rubric and outputs structured
 * verdicts per convention. Only runs if the scenario has a judge_criteria.md.
 *
 * Returns empty array if no judge criteria or if judging fails.
 */
function judgeScenario(
  scenarioDir: string,
  workDir: string,
  gymRoot: string,
  task: string,
): Judgment[] {
  const rubricPath = join(scenarioDir, "judge_criteria.md");
  if (!existsSync(rubricPath)) return [];

  const transcriptPath = join(workDir, "transcript.jsonl");
  if (!existsSync(transcriptPath)) return [];

  const rubric = readFileSync(rubricPath, "utf-8");
  const verdictPath = join(gymRoot, "judge-verdict.json");

  // Build the judge task: include the rubric, point to files
  const judgeTask = [
    "Evaluate this agent session for convention compliance.\n",
    "## Rubric\n",
    rubric,
    "\n## Task the agent was given\n",
    task,
    `\n## Files to read\n`,
    `- Transcript: ${transcriptPath}`,
    `- Conventions: ${join(PROJECT_ROOT, "agents/shared/CONVENTIONS.md")}`,
    `- Common sense: ${join(PROJECT_ROOT, "agents/shared/common-sense.md")}`,
    `- Lessons: ${join(PROJECT_ROOT, "agents/shared/LESSONS.md")}`,
    `\nWrite your verdict JSON to: ${verdictPath}`,
    `\nThen call finish() with status "success".`,
  ].join("\n");

  const judgeTaskFile = join(gymRoot, "judge-task.md");
  writeFileSync(judgeTaskFile, judgeTask);

  // Resolve judge agent
  const agentsRoot = join(PROJECT_ROOT, "agents");
  if (!existsSync(join(agentsRoot, "judge", "agent.json"))) {
    console.error("  Judge agent not found at agents/judge/ — skipping LLM judge");
    return [];
  }

  // Resolve may binary (same logic as may-agent adapter)
  let mayCmd: string[];
  const envBin = process.env["MAY_BIN"];
  if (envBin) {
    mayCmd = [envBin];
  } else {
    const binary = join(PROJECT_ROOT, "bundle/may-agent");
    if (existsSync(binary) && !isStale(binary)) {
      mayCmd = [binary];
    } else {
      mayCmd = [join(PROJECT_ROOT, "node_modules/.bin/vite-node"), join(PROJECT_ROOT, "src/app/may.ts")];
    }
  }

  const judgeState = join(gymRoot, "judge-state");
  mkdirSync(judgeState, { recursive: true });

  const cmdParts = mayCmd.map(s => `"${s}"`).join(" ");
  const fullCmd = `${cmdParts} --oneshot --agent "judge" --task-file "${judgeTaskFile}" --timeout=3`;

  try {
    execSync(fullCmd, {
      env: {
        ...process.env,
        AGENTS_ROOT: agentsRoot,
        STATE_DIR: judgeState,
      },
      timeout: 3 * 60 * 1000 + 15000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    // Judge may "fail" (non-zero exit) but still produce output
  }

  // Read verdict
  if (!existsSync(verdictPath)) {
    console.error("  Judge produced no verdict file");
    return [];
  }

  try {
    const verdict = JSON.parse(readFileSync(verdictPath, "utf-8"));
    const judgments: Judgment[] = (verdict.judgments || []).map((j: Record<string, unknown>) => ({
      convention: String(j.convention || ""),
      name: String(j.name || ""),
      verdict: String(j.verdict || "unknown") as Judgment["verdict"],
      evidence: String(j.evidence || ""),
      note: String(j.note || ""),
    }));
    return judgments;
  } catch (err) {
    console.error(`  Failed to parse judge verdict: ${err}`);
    return [];
  }
}

function isStale(binaryPath: string): boolean {
  try {
    const binaryStat = statSync(binaryPath);
    return findNewerFile(join(PROJECT_ROOT, "src"), binaryStat.mtimeMs) !== null;
  } catch {
    return false;
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

  // Export transcript so scorers can inspect agent behavior
  exportTranscript(lastResult.sessionPath, workDir);

  // Mechanical score
  const score = scoreScenario(scenarioDir, workDir);

  // LLM judge (if rubric exists)
  const taskContent = readFileSync(join(scenarioDir, "task.md"), "utf-8");
  let judgments: Judgment[] = [];
  if (existsSync(join(scenarioDir, "judge_criteria.md"))) {
    console.error("  Running LLM judge...");
    judgments = judgeScenario(scenarioDir, workDir, gymRoot, taskContent);
    const jPass = judgments.filter(j => j.verdict === "pass").length;
    console.error(`  Judge: ${jPass}/${judgments.length} conventions passed`);
  }

  // Summary combines both layers
  const judgeSummary = judgments.length > 0
    ? ` | judge: ${judgments.filter(j => j.verdict === "pass").length}/${judgments.length}`
    : "";

  return {
    scenario: scenarioName,
    adapter: adapter.name,
    agent: agentName,
    lab_fork: labFork || null,
    workflow: isWorkflow,
    passed: score.passed,
    checks: score.checks,
    judgments,
    summary: score.summary + judgeSummary,
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
          judgments: [],
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
