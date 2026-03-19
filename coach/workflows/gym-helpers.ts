/**
 * Shared gym-runner helpers for coach workflows.
 *
 * Extracted from growth-cycle.ts to allow reuse in training-sprint.ts.
 * These replace mechanical LLM sessions that just run gym scripts and
 * parse JSON output.
 */

import { execSync } from "node:child_process";
import { readdirSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const PROJECT_ROOT = resolve(join(import.meta.dirname ?? ".", "../../.."));
export const AGENTS_ROOT = resolve(process.env["AGENTS_ROOT"] || join(PROJECT_ROOT, "agents"));
export const SCENARIOS_DIR = join(PROJECT_ROOT, "test/gym/scenarios");
export const LAB_DIR = join(AGENTS_ROOT, ".lab");

export interface GymResult {
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

const KNOWN_AGENTS = ["coder", "tech-lead", "optimizer", "evaluator", "coach", "qa", "may", "amy-kimi"];

/** Run a single gym scenario and parse the JSON result. */
export function runGym(scenario: string, agent: string, labFork?: string): GymResult {
  const args = [scenario, "--agent", agent, "--timeout", "3"];
  if (labFork) args.push("--lab", labFork);
  const cmd = `test/gym/run-gym.sh ${args.map(a => `'${a}'`).join(" ")}`;

  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 4 * 60 * 1000, // 4 min timeout
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(stdout.trim());
  } catch (err: any) {
    // gym-runner.ts may exit non-zero on score failure but still produce JSON
    const stdout = (err.stdout ?? "").trim();
    try {
      return JSON.parse(stdout);
    } catch {
      return {
        scenario,
        agent,
        lab_fork: labFork ?? null,
        passed: false,
        checks: [],
        summary: `gym-runner error: ${(err.stderr ?? err.message ?? "unknown").toString().slice(0, 500)}`,
        agent_status: "error",
        duration: "0s",
        gym_root: "",
      };
    }
  }
}

/** List known gym scenario names. */
export function listScenarios(): string[] {
  try {
    return readdirSync(SCENARIOS_DIR).filter(d =>
      existsSync(join(SCENARIOS_DIR, d, "task.md"))
    );
  } catch { return []; }
}

/** Find lab forks currently in .lab/ directory. */
export function findLabForks(): string[] {
  try {
    return readdirSync(LAB_DIR).filter(d =>
      existsSync(join(LAB_DIR, d, "agent.json")) ||
      existsSync(join(LAB_DIR, d, "SOUL.md"))
    );
  } catch { return []; }
}

/** Extract scenario names mentioned in text by matching against known scenarios. */
export function extractScenarios(text: string): string[] {
  const known = listScenarios();
  return known.filter(s => text.includes(s));
}

/** Extract agent name from fork name (e.g., "coder-sprint-1" → "coder"). */
export function agentFromFork(forkName: string): string {
  for (const agent of KNOWN_AGENTS) {
    if (forkName.startsWith(agent + "-") || forkName === agent) return agent;
  }
  // Fallback: first segment before hyphen
  return forkName.split("-")[0];
}

/** Extract an agent name mentioned in free text. */
export function extractAgentFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Check for "target agent: X" or "agent: X" patterns first
  const patterns = [
    /target\s+agent[:\s]+(\w[\w-]*)/i,
    /agent[:\s]+["']?(\w[\w-]*?)["']?[\s,.\n]/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && KNOWN_AGENTS.includes(m[1].toLowerCase())) {
      return m[1].toLowerCase();
    }
  }
  // Fallback: find any known agent name mentioned
  for (const agent of KNOWN_AGENTS) {
    if (lower.includes(agent)) return agent;
  }
  return null;
}

/** Extract FM code (e.g., "FM-3.3") from text. */
export function extractFMCode(text: string): string {
  const m = text.match(/FM-\d+\.\d+/);
  return m ? m[0] : "unknown";
}

/** Extract method name/number from text. */
export function extractMethod(text: string): string {
  // Look for "Method #N" or "method: X"
  const m = text.match(/[Mm]ethod\s*#?\s*(\d+[\w\s-]*?)[\s,.\n]/);
  if (m) return `method-${m[1].trim()}`;
  const m2 = text.match(/[Mm]ethod[:\s]+["']?(.+?)["']?[\s,.\n]/);
  if (m2) return m2[1].trim();
  return "unknown";
}

/** Format gym results into a readable summary string. */
export function formatGymResults(
  baselineResults: GymResult[],
  patchedResults: GymResult[],
  forkName: string,
): string {
  const lines: string[] = ["## Gym Test Results (automated — no LLM session)", ""];
  lines.push(`Fork: ${forkName}`);
  lines.push(`Agent: ${agentFromFork(forkName)}`);
  lines.push("");

  // Build a map of scenario → { baseline, patched }
  const byScenario = new Map<string, { baseline?: GymResult; patched?: GymResult }>();

  for (const r of baselineResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.baseline = r;
    byScenario.set(r.scenario, entry);
  }
  for (const r of patchedResults) {
    const entry = byScenario.get(r.scenario) ?? {};
    entry.patched = r;
    byScenario.set(r.scenario, entry);
  }

  for (const [scenario, { baseline, patched }] of byScenario) {
    const bStatus = baseline ? (baseline.passed ? "PASS" : "FAIL") : "N/A";
    const pStatus = patched ? (patched.passed ? "PASS" : "FAIL") : "N/A";
    const bChecks = baseline ? `${baseline.checks.filter(c => c.passed).length}/${baseline.checks.length}` : "-";
    const pChecks = patched ? `${patched.checks.filter(c => c.passed).length}/${patched.checks.length}` : "-";
    lines.push(`- ${scenario}: baseline=${bStatus} (${bChecks}), patched=${pStatus} (${pChecks})`);

    // Show individual check details for patched
    if (patched) {
      for (const check of patched.checks) {
        lines.push(`  - [${check.passed ? "✓" : "✗"}] ${check.name}${check.message ? ": " + check.message : ""}`);
      }
    }
  }

  lines.push("");
  lines.push("### Raw JSON Results");
  lines.push("```json");
  lines.push(JSON.stringify({ baseline: baselineResults, patched: patchedResults }, null, 2));
  lines.push("```");

  return lines.join("\n");
}

/** Append a ceiling-effect skip record to experiments.jsonl. */
export function appendSkipRecord(
  agent: string,
  scenarios: string[],
  diagnosisText: string,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    error_pattern: extractFMCode(diagnosisText),
    agent,
    method: extractMethod(diagnosisText),
    scenarios: scenarios.map(s => ({ name: s, baseline: true, patched: null })),
    decision: "skipped",
    reason: "ceiling-effect gate: all baseline scenarios pass",
  };
  appendFileSync(
    join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl"),
    JSON.stringify(entry) + "\n",
  );
}
