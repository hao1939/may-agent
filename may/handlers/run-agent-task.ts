/**
 * run-agent-task — generic handler for cron jobs that delegate to an agent.
 *
 * Replaces the broken `fireTask` (subprocess) path. Runs the target agent
 * in-process via SubagentManager, with timeout protection.
 *
 * Supports optional pre-flight checks (via `entry.preflight`) that run a
 * lightweight JS check before spawning the LLM session. If the check returns
 * false → session is skipped entirely, saving LLM costs.
 *
 * cron.json usage:
 *   {
 *     "name": "analyze-failures",
 *     "type": "job",
 *     "handler": "run-agent-task",
 *     "agent": "bob",
 *     "message": "[cron:analyze-failures] ...",
 *     "handlerConfig": { "maxTurns": 30, "timeoutMs": 600000 },
 *     "preflight": {
 *       "type": "new-entries-since",
 *       "path": ".state/evaluations",
 *       "stateKey": "analyze-failures-last"
 *     }
 *   }
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Workflow run persistence ──────────────────────────────────────────
// Save a minimal workflow run file so session-sync can backfill workflowRunId
// into sessions spawned by this handler. Mirrors what run-workflow.ts does.

interface MinimalWorkflowRun {
  runId: string;
  workflow: string;
  parentSessionId: string | null;
  agent: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "error";
  steps: Array<{ sessionId: string; agent: string; status: string }>;
}

function saveMinimalWorkflowRun(projectRoot: string, run: MinimalWorkflowRun): void {
  const dir = join(projectRoot, ".state", "workflows");
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${run.runId}.json`), JSON.stringify(run, null, 2));
  } catch {
    // Non-fatal — coverage tracking is best-effort
  }
}
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry, PreflightCheck } from "../../../src/lib/cron-tool.js";

// ── Pre-flight state persistence ──────────────────────────────────────

interface PreflightState {
  [key: string]: { checkedAt: number; fileSize?: number; fileCount?: number };
}

function getPreflightStatePath(persistDir: string): string {
  return join(persistDir, "preflight-state.json");
}

function loadPreflightState(persistDir: string): PreflightState {
  const path = getPreflightStatePath(persistDir);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PreflightState;
  } catch {
    return {};
  }
}

function savePreflightState(persistDir: string, state: PreflightState): void {
  const path = getPreflightStatePath(persistDir);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

// ── Pre-flight check executor ─────────────────────────────────────────

/**
 * Run a pre-flight check. Returns true if the session should proceed,
 * false if it should be skipped.
 */
function runPreflightCheck(
  check: PreflightCheck,
  projectRoot: string,
  persistDir: string,
  entryName: string,
  log: (msg: string) => void,
): boolean {
  const filePath = resolve(projectRoot, check.path);

  if (check.type === "file-has-content") {
    // Check if file exists and has enough non-empty lines
    if (!existsSync(filePath)) {
      log(`[preflight:${entryName}] Skip — file not found: ${check.path}`);
      return false;
    }

    const content = readFileSync(filePath, "utf-8");
    const nonEmptyLines = content.split("\n").filter((line) => line.trim().length > 0);
    const minLines = check.minLines ?? 1;

    if (nonEmptyLines.length < minLines) {
      log(`[preflight:${entryName}] Skip — ${check.path} has ${nonEmptyLines.length} lines (need ${minLines})`);
      return false;
    }

    log(`[preflight:${entryName}] Pass — ${check.path} has ${nonEmptyLines.length} lines (≥${minLines})`);
    return true;
  }

  if (check.type === "new-entries-since") {
    const stateKey = check.stateKey || entryName;
    const state = loadPreflightState(persistDir);
    const lastCheck = state[stateKey];

    // For files: check if file size changed since last successful run
    // For directories: check if file count changed
    if (!existsSync(filePath)) {
      log(`[preflight:${entryName}] Skip — path not found: ${check.path}`);
      return false;
    }

    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Count files in directory
      const files = readdirSync(filePath);
      const currentCount = files.length;
      const lastCount = lastCheck?.fileCount ?? 0;

      if (currentCount <= lastCount) {
        log(`[preflight:${entryName}] Skip — ${check.path} has ${currentCount} files (was ${lastCount})`);
        return false;
      }
      log(`[preflight:${entryName}] Pass — ${check.path} has ${currentCount} files (was ${lastCount})`);
      return true;
    } else {
      // Check file size (for .jsonl files, new entries = larger file)
      const currentSize = stat.size;
      const lastSize = lastCheck?.fileSize ?? 0;

      if (currentSize <= lastSize) {
        log(`[preflight:${entryName}] Skip — ${check.path} size ${currentSize} bytes (was ${lastSize})`);
        return false;
      }
      log(`[preflight:${entryName}] Pass — ${check.path} size ${currentSize} bytes (was ${lastSize})`);
      return true;
    }
  }

  // Unknown check type — proceed (don't block on config error)
  log(`[preflight:${entryName}] Unknown check type "${check.type}" — proceeding`);
  return true;
}

/**
 * Update preflight state after a successful session run.
 * Records current file size/count so the next preflight check can detect changes.
 */
function updatePreflightState(
  check: PreflightCheck,
  projectRoot: string,
  persistDir: string,
  entryName: string,
): void {
  const stateKey = check.stateKey || entryName;
  const filePath = resolve(projectRoot, check.path);
  const state = loadPreflightState(persistDir);

  if (!existsSync(filePath)) {
    state[stateKey] = { checkedAt: Date.now() };
  } else {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      const files = readdirSync(filePath);
      state[stateKey] = { checkedAt: Date.now(), fileCount: files.length };
    } else {
      state[stateKey] = { checkedAt: Date.now(), fileSize: stat.size };
    }
  }

  savePreflightState(persistDir, state);
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    /** Maximum time to wait for the agent session (default: 10 min). */
    timeoutMs?: number;
    /** Whether to wait for the session to complete (default: true). */
    waitForCompletion?: boolean;
    /** Override agent's default opBudget (max turns) for this cron job. */
    maxTurns?: number;
  };

  const agentName = entry.agent || "may";
  const timeoutMs = config.timeoutMs ?? 600_000; // 10 min default
  const waitForCompletion = config.waitForCompletion !== false;
  const maxTurns = config.maxTurns;

  return async () => {
    const message = entry.message || `[cron:${entry.name}] Execute your task.`;

    // ── Pre-flight check ────────────────────────────────────────────
    if (entry.preflight) {
      const shouldProceed = runPreflightCheck(
        entry.preflight,
        ctx.projectRoot,
        ctx.persistDir,
        entry.name,
        ctx.log,
      );
      if (!shouldProceed) {
        ctx.log(`[run-agent-task:${entry.name}] Skipped — pre-flight check failed`);
        return;
      }
    }

    ctx.log(`[run-agent-task:${entry.name}] Starting ${agentName} session...`);

    const workflowRunId = `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sessionId = ctx.manager.run(agentName, message, {
      source: "cron",
      workflowRunId,
      ...(maxTurns ? { opBudget: maxTurns } : {}),
    });

    ctx.log(`[run-agent-task:${entry.name}] Started ${agentName} session: ${sessionId}`);

    // Save workflow run file so session-sync can backfill workflowRunId
    const wfRun: MinimalWorkflowRun = {
      runId: workflowRunId,
      workflow: `run-agent-task:${entry.name}`,
      parentSessionId: null,
      agent: agentName,
      startedAt: Date.now(),
      status: "running",
      steps: [{ sessionId, agent: agentName, status: "running" }],
    };
    saveMinimalWorkflowRun(ctx.projectRoot, wfRun);

    if (!waitForCompletion) {
      // Update preflight state even for fire-and-forget (we fired it)
      if (entry.preflight) {
        updatePreflightState(entry.preflight, ctx.projectRoot, ctx.persistDir, entry.name);
      }
      ctx.log(`[run-agent-task:${entry.name}] Fire-and-forget mode — not waiting.`);
      return;
    }

    // Wait for completion with timeout
    const result = await Promise.race([
      ctx.manager.waitFor(sessionId).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Agent session failed: ${errMsg}`);
      }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        // Don't hold the process open
        if (timer.unref) timer.unref();
      }),
    ]).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);

      // On timeout, cancel the session so it doesn't run forever
      if (errMsg.includes("Timeout")) {
        ctx.log(`[run-agent-task:${entry.name}] ⚠️ ${agentName} timed out after ${timeoutMs}ms — cancelling session ${sessionId}`);
        try {
          ctx.manager.cancel(sessionId);
        } catch {
          // Session may have already finished between timeout and cancel
        }
      }

      throw new Error(`[run-agent-task:${entry.name}] ${agentName} failed: ${errMsg}`);
    });

    // Update preflight state on successful completion
    if (entry.preflight) {
      updatePreflightState(entry.preflight, ctx.projectRoot, ctx.persistDir, entry.name);
    }

    ctx.log(`[run-agent-task:${entry.name}] ${agentName} completed: ${result.status}`);
  };
};

// ── Named export for direct programmatic use ──────────────────────────

/**
 * Run an agent task directly (outside cron).
 * Mirrors the cron handler logic for use by other handlers or one-off calls.
 */
export async function runAgentTask(
  ctx: HandlerContext,
  params: {
    agent: string;
    message: string;
    timeoutMs?: number;
    waitForCompletion?: boolean;
  },
): Promise<{ sessionId: string; status: string }> {
  const { agent, message, timeoutMs = 600_000, waitForCompletion = true } = params;

  const workflowRunId = `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const sessionId = ctx.manager.run(agent, message, { source: "handler", workflowRunId });
  ctx.log(`[runAgentTask] Started ${agent} session: ${sessionId}`);

  if (!waitForCompletion) {
    return { sessionId, status: "started" };
  }

  const result = await Promise.race([
    ctx.manager.waitFor(sessionId),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
      if (timer.unref) timer.unref();
    }),
  ]).catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Timeout")) {
      try { ctx.manager.cancel(sessionId); } catch { /* already done */ }
    }
    throw new Error(`runAgentTask(${agent}) failed: ${errMsg}`);
  });

  return { sessionId, status: result.status };
}

// ── Exports for testing ───────────────────────────────────────────────

export { runPreflightCheck, updatePreflightState, loadPreflightState, savePreflightState };
export type { PreflightState };
