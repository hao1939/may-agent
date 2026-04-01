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
import { createHash } from "node:crypto";
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
import { learnFromSession } from "../../src/lib/context-learn.js";

// ── Types ──────────────────────────────────────────────────────────────

interface ScenarioMeta {
  name: string;
  categories: string[];
  tags: string[];
  tier: "smoke" | "standard" | "full";
  timeout: number;
  agent_type: string;
  workflow: boolean;
  /** Run context learning between workflow phases. */
  learn_between_phases?: boolean;
  /** Paths (relative to workDir) to delete between workflow phases. */
  phase_cleanup?: string[];
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
  prompt_hash: string | null;
  prompt_text: string | null;
  framework_sha: string | null;
  model: string | null;
  categories: string[];
  tags: string[];
  tier: string | null;
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
  /** Copy agents to gym-local dir so context.md persists between phases. */
  sandboxAgents?: boolean;
}

// ── Paths ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const SCENARIOS_DIR = join(PROJECT_ROOT, "agents/gym/scenarios");

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
      } else if (opts.sandboxAgents) {
        // Copy agents to gym-local dir so writes (e.g. context.md) don't pollute the real dir
        const gymAgents = join(opts.gymRoot, "agents-sandbox");
        cpSync(join(projectRoot, "agents"), gymAgents, { recursive: true });
        rmSync(join(gymAgents, ".lab"), { recursive: true, force: true });
        rmSync(join(gymAgents, ".git"), { recursive: true, force: true });
        agentsRoot = gymAgents;
      } else {
        agentsRoot = join(projectRoot, "agents");
      }

      // Verify agent exists
      const agentDir = join(agentsRoot, opts.agentName);
      if (!existsSync(join(agentDir, "agent.json"))) {
        throw new Error(`Agent '${opts.agentName}' not found in: ${agentsRoot}`);
      }

      // ── Identity injection handled above in runAgent() ──────────────

      // Resolve binary — prefer compiled binary even if stale.
      // vite-node requires Node 20+ (crypto.hash) so it's not a safe fallback.
      const envBin = process.env["MAY_BIN"];
      if (envBin) {
        mayCmd = [envBin];
      } else {
        const binary = join(projectRoot, "bundle/may-agent");
        if (existsSync(binary)) {
          try {
            const binaryStat = statSync(binary);
            const newerFile = findNewerFile(join(projectRoot, "src"), binaryStat.mtimeMs);
            if (newerFile !== null) {
              console.error(
                `Warning: compiled binary is stale (newer: ${newerFile}). Using it anyway — rebuild with: bun run bundle`,
              );
            }
          } catch {
            /* assume fresh */
          }
          mayCmd = [binary];
        } else {
          // No binary at all — try vite-node as last resort
          console.error("Warning: no compiled binary found. Falling back to vite-node (requires Node 20+).");
          mayCmd = [join(projectRoot, "node_modules/.bin/vite-node"), join(projectRoot, "src/app/may.ts")];
        }
      }
    },

    runAgent(taskFile: string, _workDir: string, timeoutMin: number): AdapterResult {
      const gymState = join(gymRoot, "state");
      mkdirSync(gymState, { recursive: true });

      // ── Identity Sandbox ───────────────────────────────────────────
      // Copy agent directory into workDir/agents/<name>/ so the agent
      // can read("agents/<name>/heartbeat.md") etc. from its CWD.
      // This is a sandbox copy — writes go to the temp dir, not prod.
      const agentDir = join(agentsRoot, agentName);
      const agentDest = join(_workDir, "agents", agentName);
      if (existsSync(agentDir) && !existsSync(agentDest)) {
        mkdirSync(join(_workDir, "agents"), { recursive: true });
        cpSync(agentDir, agentDest, { recursive: true });
      }

      const cmdParts = mayCmd.map((s) => `"${s}"`).join(" ");
      const fullCmd = `${cmdParts} --oneshot --agent "${agentName}" --task-file "${taskFile}" --timeout=${timeoutMin}`;

      try {
        const stdout = execSync(fullCmd, {
          cwd: _workDir,
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
      for (const candidate of [join(gymState, "sessions", sessionId), join(gymState, "sessions/history", sessionId)]) {
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
          },
        );
        return { sessionId: "", status: "success", sessionPath: "" };
      } catch (err: unknown) {
        const e = err as { killed?: boolean; signal?: string };
        const status = e.killed || e.signal === "SIGTERM" ? "timeout" : "error";
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
            "Example: GYM_AGENT_CMD='my-agent --task-file' bash test/gym/run-gym.sh phantom-fix --adapter generic",
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
        const status = e.killed || e.signal === "SIGTERM" ? "timeout" : "error";
        return { sessionId: "", status, sessionPath: "" };
      }
    },
  };
}

// ── Adapter registry ───────────────────────────────────────────────────

const ADAPTERS: Record<string, () => Adapter> = {
  "may-agent": createMayAgentAdapter,
  "claude-code": createClaudeCodeAdapter,
  generic: createGenericAdapter,
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
    .filter((name) => {
      const dir = join(SCENARIOS_DIR, name);
      return (
        existsSync(join(dir, "task.md")) &&
        existsSync(join(dir, "success_criteria.js")) &&
        existsSync(join(dir, "environment"))
      );
    })
    .sort();
}

function matchesFilters(meta: ScenarioMeta | null, tier?: string, category?: string, tag?: string): boolean {
  if (!tier && !category && !tag) return true;
  if (!meta) return false;

  if (tier) {
    // Tier hierarchy: smoke < standard < full
    switch (tier) {
      case "smoke":
        if ((meta.tier || "") !== "smoke") return false;
        break;
      case "standard":
        if ((meta.tier || "") !== "smoke" && (meta.tier || "") !== "standard") return false;
        break;
      case "full":
        break; // everything matches
      default:
        if ((meta.tier || "") !== tier) return false;
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
    JSON.stringify({ note: "session path found but no transcript file detected", sessionPath }) + "\n",
  );
}

/**
 * For workflow scenarios: concatenate transcripts from all phases into a single
 * combined transcript.jsonl. This allows success_criteria.js behavioral checks
 * to see the full sequence of tool calls across all phases, not just the last one.
 */
function exportCombinedTranscript(phaseResults: AdapterResult[], workDir: string): void {
  const transcriptDest = join(workDir, "transcript.jsonl");
  let combined = "";

  for (const result of phaseResults) {
    const sessionPath = result.sessionPath;
    if (!sessionPath || !existsSync(sessionPath)) continue;

    let phaseTranscript = "";

    if (sessionPath.endsWith(".jsonl") && existsSync(sessionPath)) {
      phaseTranscript = readFileSync(sessionPath, "utf-8");
    } else {
      // Look for .jsonl files in the session directory
      try {
        const files = readdirSync(sessionPath).filter((f) => f.endsWith(".jsonl"));
        if (files.length > 0) {
          let best = files[0];
          let bestSize = 0;
          for (const f of files) {
            const sz = statSync(join(sessionPath, f)).size;
            if (sz > bestSize) {
              bestSize = sz;
              best = f;
            }
          }
          phaseTranscript = readFileSync(join(sessionPath, best), "utf-8");
        }
      } catch {
        // skip this phase
      }
    }

    if (phaseTranscript) {
      combined += phaseTranscript;
      // Ensure newline separator between phases
      if (!combined.endsWith("\n")) combined += "\n";
    }
  }

  if (combined) {
    writeFileSync(transcriptDest, combined);
  } else {
    // Fallback: try last phase only
    exportTranscript(phaseResults[phaseResults.length - 1]?.sessionPath ?? "", workDir);
  }
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
  } catch (err: unknown) {
    // Scorers exit non-zero on failure but still emit valid JSON to stdout.
    // execSync throws on non-zero exit, so capture stdout from the error.
    const execErr = err as { stdout?: string; stderr?: string };
    if (execErr.stdout) {
      try {
        return JSON.parse(execErr.stdout.trim());
      } catch {
        // stdout wasn't valid JSON — fall through to generic failure
      }
    }
    const stderr = execErr.stderr ? ` (${execErr.stderr.trim().slice(0, 200)})` : "";
    return { passed: false, checks: [], summary: `scoring failed${stderr}` };
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
function judgeScenario(scenarioDir: string, workDir: string, gymRoot: string, task: string): Judgment[] {
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

  // Resolve may binary — prefer compiled binary even if stale (vite-node needs Node 20+)
  let mayCmd: string[];
  const envBin = process.env["MAY_BIN"];
  if (envBin) {
    mayCmd = [envBin];
  } else {
    const binary = join(PROJECT_ROOT, "bundle/may-agent");
    if (existsSync(binary)) {
      if (isStale(binary)) {
        console.error("  Warning: binary stale for judge — using it anyway.");
      }
      mayCmd = [binary];
    } else {
      console.error("  Warning: no compiled binary — falling back to vite-node (requires Node 20+).");
      mayCmd = [join(PROJECT_ROOT, "node_modules/.bin/vite-node"), join(PROJECT_ROOT, "src/app/may.ts")];
    }
  }

  const judgeState = join(gymRoot, "judge-state");
  mkdirSync(judgeState, { recursive: true });

  const cmdParts = mayCmd.map((s) => `"${s}"`).join(" ");
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
  const learnBetween = meta?.learn_between_phases ?? false;
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
  adapter.setup(PROJECT_ROOT, { agentName, labFork, gymRoot, sandboxAgents: learnBetween });

  const startMs = Date.now();
  let lastResult: AdapterResult = { sessionId: "", status: "unknown", sessionPath: "" };
  const allPhaseResults: AdapterResult[] = [];

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
      allPhaseResults.push(lastResult);
      console.error(`Phase ${i + 1} complete (session: ${lastResult.sessionId})`);

      // Context learning between phases: extract facts from this phase's transcript
      // and write to the agent's context.md in the sandbox
      if (learnBetween && i < parts.length - 1 && lastResult.sessionPath) {
        try {
          const sessionDir = lastResult.sessionPath;
          const jsonlPath =
            existsSync(sessionDir) && statSync(sessionDir).isDirectory()
              ? readdirSync(sessionDir)
                  .filter((f) => f.endsWith(".jsonl"))
                  .map((f) => join(sessionDir, f))[0]
              : sessionDir;
          if (jsonlPath && existsSync(jsonlPath)) {
            const lines = readFileSync(jsonlPath, "utf-8")
              .split("\n")
              .filter((l) => l.trim());
            const messages = lines
              .map((l) => {
                try {
                  return JSON.parse(l);
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

            // Write to the sandbox agents dir (where AGENTS_ROOT points)
            const sandboxAgentDir = join(gymRoot, "agents-sandbox", agentName);
            // Also write to workDir agents dir (for success_criteria to inspect)
            const workAgentDir = join(workDir, "agents", agentName);

            for (const dir of [sandboxAgentDir, workAgentDir]) {
              if (existsSync(dir)) {
                const result = learnFromSession({ agentDir: dir, messages });
                if (result.added.length > 0) {
                  console.error(`  Context-learn: +${result.added.length} fact(s) → ${dir}/context.md`);
                }
              }
            }
          }
        } catch (err) {
          console.error(`  Context-learn error: ${err instanceof Error ? err.message : err}`);
        }
      }

      // Phase cleanup: delete specified paths between phases
      const phaseCleanup = meta?.phase_cleanup ?? [];
      for (const rel of phaseCleanup) {
        const target = join(workDir, rel);
        if (existsSync(target)) {
          rmSync(target, { recursive: true, force: true });
          console.error(`  Phase cleanup: deleted ${rel}`);
        }
      }
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
  // For workflow scenarios, concatenate all phase transcripts so behavioral
  // checks can see the full sequence of tool calls across all phases
  if (isWorkflow && allPhaseResults.length > 1) {
    exportCombinedTranscript(allPhaseResults, workDir);
  } else {
    exportTranscript(lastResult.sessionPath, workDir);
  }

  // Mechanical score
  const score = scoreScenario(scenarioDir, workDir);

  // LLM judge (if rubric exists)
  const taskContent = readFileSync(join(scenarioDir, "task.md"), "utf-8");
  let judgments: Judgment[] = [];
  if (existsSync(join(scenarioDir, "judge_criteria.md"))) {
    console.error("  Running LLM judge...");
    judgments = judgeScenario(scenarioDir, workDir, gymRoot, taskContent);
    const jPass = judgments.filter((j) => j.verdict === "pass").length;
    console.error(`  Judge: ${jPass}/${judgments.length} conventions passed`);
  }

  // Summary combines both layers
  const judgeSummary =
    judgments.length > 0 ? ` | judge: ${judgments.filter((j) => j.verdict === "pass").length}/${judgments.length}` : "";

  // Compute benchmark identity
  // Derive the effective agentsRoot the same way the adapter does:
  // lab fork → gymRoot/agents-lab, otherwise → PROJECT_ROOT/agents
  const effectiveAgentsRoot = labFork ? join(gymRoot, "agents-lab") : join(PROJECT_ROOT, "agents");
  const frameworkSha = computeFrameworkSha();
  const model = readAgentModel(effectiveAgentsRoot, agentName);
  const prompt = assembleEffectivePrompt(effectiveAgentsRoot, agentName);

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
    prompt_hash: prompt?.hash ?? null,
    prompt_text: prompt?.text ?? null,
    framework_sha: frameworkSha,
    model,
    categories: meta?.categories ?? [],
    tags: meta?.tags ?? [],
    tier: meta?.tier ?? null,
  };
}

// ── Utilities ──────────────────────────────────────────────────────────

/**
 * Get the current git short SHA for the framework.
 */
function computeFrameworkSha(): string | null {
  try {
    return (
      execSync("git rev-parse --short HEAD", {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Read the `model` field from an agent's agent.json.
 */
function readAgentModel(agentsRoot: string, agentName: string): string | null {
  try {
    const agentJson = join(agentsRoot, agentName, "agent.json");
    if (!existsSync(agentJson)) return null;
    const parsed = JSON.parse(readFileSync(agentJson, "utf-8"));
    return typeof parsed.model === "string" ? parsed.model : null;
  } catch {
    return null;
  }
}

/**
 * Assemble the effective system prompt, mirroring resolveSystemPrompt() in manager.ts.
 *
 * This reproduces the exact prompt the agent sees during a gym run:
 *   1. SOUL.md (per-agent identity)
 *   2. common-sense.md (shared behavioral rules)
 *   3. Runtime Environment (generated)
 *   4. Available Tools (from agent.json tools list)
 *
 * Returns the full prompt text + its SHA-256 hash (first 12 hex chars).
 */
function assembleEffectivePrompt(agentsRoot: string, agentName: string): { hash: string; text: string } | null {
  try {
    const agentDir = join(agentsRoot, agentName);
    if (!existsSync(agentDir)) return null;

    const sections: string[] = [];

    const loadFile = (path: string): string | undefined => {
      if (!existsSync(path)) return undefined;
      const content = readFileSync(path, "utf-8").trim();
      return content || undefined;
    };

    // 1. SOUL.md — agent identity
    const soul = loadFile(join(agentDir, "SOUL.md"));
    if (soul) sections.push(soul);

    // 2. common-sense.md — shared behavioral rules
    const sharedCommonSense = join(agentsRoot, "shared", "common-sense.md");
    const sharedFallback = join(PROJECT_ROOT, "agents", "shared", "common-sense.md");
    const commonSense = loadFile(existsSync(sharedCommonSense) ? sharedCommonSense : sharedFallback);
    if (commonSense) sections.push(commonSense);

    // 3. Skills — behavioral patches from skills/*.md
    const skillsDir = join(agentDir, "skills");
    if (existsSync(skillsDir)) {
      const skillFiles = readdirSync(skillsDir, { recursive: true })
        .map((f) => String(f))
        .filter((f) => f.endsWith(".md"))
        .sort();
      for (const sf of skillFiles) {
        const skillContent = loadFile(join(skillsDir, sf));
        if (skillContent) sections.push(skillContent);
      }
    }
    // Note: shared skills (agents/shared/skills/) are a reference library,
    // NOT auto-loaded. Agents adopt specific skills by copying into their
    // own skills/ directory (e.g., via growth-cycle lab forks).

    // 4. Runtime Environment (generated — matches manager.ts)
    const knowledgeDir = join(agentDir, "knowledge");
    const workspace = join(agentDir, "workspace");
    const envLines = ["# Runtime Environment"];
    envLines.push(`- Project root: ${PROJECT_ROOT}`);
    envLines.push(`- Agent directory: agents/${agentName}`);
    if (existsSync(workspace)) envLines.push(`- Workspace: agents/${agentName}/workspace (ephemeral scratch)`);
    if (existsSync(knowledgeDir)) envLines.push(`- Knowledge: agents/${agentName}/knowledge`);
    envLines.push(`- Already in context (do NOT re-read): SOUL.md, common-sense.md`);
    envLines.push(`- Knowledge index: knowledge/INDEX.md (read when you need references)`);
    envLines.push(``);
    envLines.push(`All paths are relative to project root. Your workspace is the ONLY directory you should write to.`);
    sections.push(envLines.join("\n"));

    // 4. Available Tools (from agent.json)
    try {
      const agentJson = JSON.parse(readFileSync(join(agentDir, "agent.json"), "utf-8"));
      if (Array.isArray(agentJson.tools) && agentJson.tools.length > 0) {
        sections.push(
          `## Available Tools\nYou have access to these tools (and ONLY these): ${agentJson.tools.join(", ")}.\nDo not attempt to call any tool not in this list.`,
        );
      }
    } catch {
      /* no agent.json or invalid */
    }

    if (sections.length === 0) return null;

    const text = `<system_instructions>\n${sections.join("\n\n")}\n</system_instructions>`;
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 12);

    return { hash, text };
  } catch {
    return null;
  }
}

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
  } catch {
    /* ignore */
  }
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
      case "--adapter":
        args.adapter = argv[++i];
        break;
      case "--agent":
        args.agent = argv[++i];
        break;
      case "--lab":
        args.lab = argv[++i];
        break;
      case "--timeout":
        args.timeout = parseInt(argv[++i]);
        break;
      case "--tier":
        args.tier = argv[++i];
        break;
      case "--category":
        args.category = argv[++i];
        break;
      case "--tag":
        args.tag = argv[++i];
        break;
      case "--list":
        args.list = true;
        break;
      case "--run-all":
        args.runAll = true;
        break;
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
        const tier = meta.tier || "unknown";
        const cats = (meta.categories || []).join(",");
        console.log(`${name.padEnd(42)} tier=${tier.padEnd(10)} categories=${cats}`);
      } else {
        console.log(`${name.padEnd(42)} (no metadata)`);
      }
    }
    return;
  }

  // ── Run-all mode ─────────────────────────────────────────────────
  if (args.runAll) {
    const scenarios = listScenarios().filter((name) => {
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
          prompt_hash: null,
          prompt_text: null,
          framework_sha: null,
          model: null,
          categories: [],
          tags: [],
          tier: null,
        });
      }
    }

    const total = scenarios.length;
    const pct = total > 0 ? Math.round((passCount * 100) / total) : 0;
    console.error(`\nResults: ${passCount}/${total} passed (${pct}%)`);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // ── Single scenario ──────────────────────────────────────────────
  if (!args.scenario) {
    console.error("Usage:");
    console.error("  bash test/gym/run-gym.sh <scenario> [options]");
    console.error("  bash test/gym/run-gym.sh --list [--tier <t>] [--category <c>] [--tag <t>]");
    console.error("  bash test/gym/run-gym.sh --run-all [--tier <t>] [--category <c>]");
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
