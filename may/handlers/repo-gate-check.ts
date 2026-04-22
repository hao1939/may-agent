/**
 * repo-gate-check.ts — QA Repo Gate: deterministic pre-checks before QA heartbeat.
 *
 * Runs every 30 minutes (aligned with QA heartbeat interval). Checks if there
 * are new commits since the last QA review. If so, runs `tsc --noEmit` and
 * `vitest --run` deterministically and writes results to .state/qa-gate-results.json
 * for QA to consume.
 *
 * If no new commits, writes a "skip" result so QA's heartbeat knows to skip.
 * The QA heartbeat reads this file first and skips the deterministic checks,
 * focusing LLM time on judgment-based code review.
 *
 * **Savings estimate**: Skip 50-70% of QA sessions (~$5-8/day) and reduce
 * context usage in sessions that do run (no tsc/vitest tool calls needed).
 *
 * Source: agents/optimizer/workspace/patches/proposal-qa-repo-gate-handler.md
 * Request: req:ea412c40
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface GateResult {
  timestamp: string;
  commit: string;
  previousCommit: string | null;
  newCommits: boolean;
  newCommitCount: number;
  /** Summary of new commits (for QA context injection). */
  commitSummary: string;
  tsc: {
    pass: boolean;
    output: string;
    durationMs: number;
  } | null;
  vitest: {
    pass: boolean;
    output: string;
    durationMs: number;
  } | null;
  /** Whether QA session should be triggered. */
  shouldRunQA: boolean;
  /** Human-readable reason for skip/run decision. */
  reason: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const LAST_COMMIT_FILE = ".state/qa-last-commit.txt";
const GATE_RESULTS_FILE = ".state/qa-gate-results.json";
/** Trigger file — only exists when QA should run. QA heartbeat has a preflight on this. */
const GATE_TRIGGER_FILE = ".state/qa-gate-trigger.json";
const TSC_TIMEOUT_MS = 60_000;
const VITEST_TIMEOUT_MS = 120_000;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const result = runRepoGateCheck(ctx);

    if (result.shouldRunQA) {
      ctx.log(
        `[repo-gate] ✅ ${result.newCommitCount} new commit(s). ` +
        `tsc: ${result.tsc?.pass ? "PASS" : "FAIL"}, ` +
        `vitest: ${result.vitest?.pass ? "PASS" : "FAIL"}. ` +
        `Sending gate results to QA.`
      );
      // Send request to QA with gate results
      const gateContext = [
        `## Repo Gate Results (pre-computed)`,
        `- Commits: ${result.newCommitCount} new since ${(result.previousCommit || "initial").slice(0, 7)}`,
        `- tsc: ${result.tsc?.pass ? "PASS ✅" : "FAIL ❌"}`,
        `- vitest: ${result.vitest?.pass ? "PASS ✅" : "FAIL ❌"}`,
        result.tsc && !result.tsc.pass ? `\n### tsc errors:\n\`\`\`\n${result.tsc.output.slice(0, 500)}\n\`\`\`` : "",
        result.vitest && !result.vitest.pass ? `\n### vitest failures:\n\`\`\`\n${result.vitest.output.slice(0, 500)}\n\`\`\`` : "",
        `\n### Commits:\n${result.commitSummary}`,
      ].filter(Boolean).join("\n");

      ctx.emit({
        type: "message_created",
        from: "repo-gate",
        to: "qa",
        task: `Review ${result.newCommitCount} new commit(s). Gate results: tsc=${result.tsc?.pass ? "PASS" : "FAIL"}, vitest=${result.vitest?.pass ? "PASS" : "FAIL"}. Full results in .state/qa-gate-results.json`,
        requestId: `rg-${Date.now()}`,
      });
    } else {
      ctx.log(`[repo-gate] ⏭️ Skipping QA: ${result.reason}`);
    }
  };
};

// ── Core logic ────────────────────────────────────────────────────────

export function runRepoGateCheck(ctx: HandlerContext): GateResult {
  const stateDir = join(ctx.projectRoot, ".state");
  mkdirSync(stateDir, { recursive: true });

  const lastCommitPath = join(ctx.projectRoot, LAST_COMMIT_FILE);
  const gateResultsPath = join(ctx.projectRoot, GATE_RESULTS_FILE);
  const triggerPath = join(ctx.projectRoot, GATE_TRIGGER_FILE);

  // 1. Get current HEAD commit
  let currentCommit: string;
  try {
    currentCommit = execSync("git rev-parse HEAD", {
      cwd: ctx.projectRoot,
      timeout: 10_000,
      stdio: "pipe",
    }).toString().trim();
  } catch (err: any) {
    // Git not available or not a repo — always run QA
    const result: GateResult = {
      timestamp: new Date().toISOString(),
      commit: "unknown",
      previousCommit: null,
      newCommits: true,
      newCommitCount: 0,
      commitSummary: "Could not determine git status",
      tsc: null,
      vitest: null,
      shouldRunQA: true,
      reason: `Git error: ${err.message?.slice(0, 100)}. Running QA as fallback.`,
    };
    writeFileSync(gateResultsPath, JSON.stringify(result, null, 2));
    return result;
  }

  // 2. Read last reviewed commit
  let previousCommit: string | null = null;
  try {
    if (existsSync(lastCommitPath)) {
      previousCommit = readFileSync(lastCommitPath, "utf-8").trim();
    }
  } catch {
    // Ignore — treat as first run
  }

  // 3. Check if there are new commits
  let newCommitCount = 0;
  let commitSummary = "";

  if (previousCommit && previousCommit === currentCommit) {
    // No new commits — remove trigger file so QA heartbeat preflight skips
    try { unlinkSync(triggerPath); } catch { /* doesn't exist — fine */ }
    const result: GateResult = {
      timestamp: new Date().toISOString(),
      commit: currentCommit,
      previousCommit,
      newCommits: false,
      newCommitCount: 0,
      commitSummary: "No new commits since last QA review.",
      tsc: null,
      vitest: null,
      shouldRunQA: false,
      reason: "No new commits since last review.",
    };
    writeFileSync(gateResultsPath, JSON.stringify(result, null, 2));
    return result;
  }

  if (previousCommit) {
    // Count commits between previous and current
    try {
      const countOutput = execSync(
        `git rev-list --count ${previousCommit}..${currentCommit}`,
        { cwd: ctx.projectRoot, timeout: 10_000, stdio: "pipe" }
      ).toString().trim();
      newCommitCount = parseInt(countOutput, 10) || 1;

      // Get summary of new commits (max 10 lines)
      const logOutput = execSync(
        `git log --oneline ${previousCommit}..${currentCommit} | head -10`,
        { cwd: ctx.projectRoot, timeout: 10_000, stdio: "pipe" }
      ).toString().trim();
      commitSummary = logOutput;
    } catch {
      newCommitCount = 1;
      commitSummary = `New commits since ${previousCommit.slice(0, 7)}`;
    }
  } else {
    // First run — just note the current commit
    newCommitCount = 1;
    commitSummary = `First QA gate run. Current HEAD: ${currentCommit.slice(0, 7)}`;
  }

  // 4. Run deterministic gates
  const tscResult = runTsc(ctx);
  const vitestResult = runVitest(ctx);

  // 5. Update last-reviewed commit
  writeFileSync(lastCommitPath, currentCommit + "\n");

  // 6. Write results
  const result: GateResult = {
    timestamp: new Date().toISOString(),
    commit: currentCommit,
    previousCommit,
    newCommits: true,
    newCommitCount,
    commitSummary,
    tsc: tscResult,
    vitest: vitestResult,
    shouldRunQA: true,
    reason: `${newCommitCount} new commit(s) found. Gates: tsc=${tscResult.pass ? "PASS" : "FAIL"}, vitest=${vitestResult.pass ? "PASS" : "FAIL"}.`,
  };

  writeFileSync(gateResultsPath, JSON.stringify(result, null, 2));

  // Write trigger file so QA heartbeat preflight sees new work
  writeFileSync(triggerPath, JSON.stringify({
    shouldRunQA: true,
    commit: currentCommit,
    timestamp: new Date().toISOString(),
  }, null, 2));

  return result;
}

// ── Sub-checks ────────────────────────────────────────────────────────

function runTsc(ctx: HandlerContext): GateResult["tsc"] {
  const start = Date.now();
  try {
    const output = execSync("node_modules/.bin/tsc --noEmit 2>&1", {
      cwd: ctx.projectRoot,
      timeout: TSC_TIMEOUT_MS,
      stdio: "pipe",
    }).toString();
    return {
      pass: true,
      output: output.slice(0, 2000),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return {
      pass: false,
      output: output.slice(0, 2000),
      durationMs: Date.now() - start,
    };
  }
}

function runVitest(ctx: HandlerContext): GateResult["vitest"] {
  const start = Date.now();
  try {
    const output = execSync("node_modules/.bin/vitest --run 2>&1", {
      cwd: ctx.projectRoot,
      timeout: VITEST_TIMEOUT_MS,
      stdio: "pipe",
    }).toString();
    return {
      pass: true,
      output: output.slice(0, 2000),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return {
      pass: false,
      output: output.slice(0, 2000),
      durationMs: Date.now() - start,
    };
  }
}
