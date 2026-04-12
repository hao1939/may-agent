/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * auto-loop — Multi-cycle autonomous execution workflow
 *
 * Chains heterogeneous tasks through plan → execute → evaluate cycles,
 * with a "done?" gate at each iteration. Supports:
 *   - Inline task definition (creates a state file)
 *   - Resume from existing state file
 *   - Stuck detection and escalation
 *   - Adaptive replanning (evaluator says REVISE)
 *
 * Input format:
 *   Option A — Inline task:
 *     agent: <agent-name>
 *     maxCycles: <N>
 *     task: <description>
 *
 *   Option B — Path to existing state file:
 *     /path/to/auto-loop/state.json
 *
 * State file lives at:
 *   agents/<agent>/workspace/auto-loop/<slug>.json
 *
 * Based on merged design from tech-lead + Bob.
 * See: agents/may/workspace/auto-loop-synthesis.md
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface AutoLoopState {
  task: string;
  agent: string;
  phase: "plan" | "execute" | "evaluate" | "done";
  cycle: number;
  maxCycles: number;
  status: "active" | "paused" | "done" | "stuck";
  stuckCount: number;
  created: string;
  lastCycleAt: string | null;
  plan: string[];
  history: HistoryEntry[];
  context: LoopContext;
}

interface HistoryEntry {
  cycle: number;
  phase: string;
  result: string;
  files: string[];
  duration: string;
}

interface LoopContext {
  keyFindings: string[];
  openQuestions: string[];
  blockers: string[];
}

// ── Exports ────────────────────────────────────────────────────────────

export const name: string = "auto-loop";

export const description: string =
  "Multi-cycle autonomous execution: plan → execute → evaluate loop " +
  "with stuck detection, adaptive replanning, and state persistence.";

// ── Input parsing ──────────────────────────────────────────────────────

interface InlineInput {
  type: "inline";
  agent: string;
  maxCycles: number;
  task: string;
}

interface FileInput {
  type: "file";
  path: string;
}

type ParsedInput = InlineInput | FileInput;

function parseInput(raw: string): ParsedInput {
  // Check if it looks like a file path (has extension and no "agent:" line)
  const trimmed = raw.trim();

  // If it has agent: and task: lines, it's inline
  const agentMatch = trimmed.match(/^agent:\s*(.+)$/m);
  const taskMatch = trimmed.match(/^task:\s*(.+)$/m);

  if (agentMatch && taskMatch) {
    const cyclesMatch = trimmed.match(/^maxCycles:\s*(\d+)$/m);
    return {
      type: "inline",
      agent: agentMatch[1].trim(),
      maxCycles: cyclesMatch ? parseInt(cyclesMatch[1], 10) : 10,
      task: taskMatch[1].trim(),
    };
  }

  // Otherwise treat as a file path
  return { type: "file", path: trimmed };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createInitialState(input: InlineInput): AutoLoopState {
  return {
    task: input.task,
    agent: input.agent,
    phase: "plan",
    cycle: 1,
    maxCycles: input.maxCycles,
    status: "active",
    stuckCount: 0,
    created: new Date().toISOString(),
    lastCycleAt: null,
    plan: [],
    history: [],
    context: { keyFindings: [], openQuestions: [], blockers: [] },
  };
}

function loadState(path: string): AutoLoopState {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

function saveState(state: AutoLoopState, path: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

function getStatePath(state: AutoLoopState): string {
  const slug = slugify(state.task);
  return join("agents", state.agent, "workspace", "auto-loop", `${slug}.json`);
}

// ── Decision extraction ────────────────────────────────────────────────

type EvalDecision = "done" | "continue" | "revise";

function extractDecision(text: string): EvalDecision {
  const upper = text.toUpperCase();
  if (upper.includes("DECISION: DONE") || upper.includes("## DONE")) {
    return "done";
  }
  if (upper.includes("REVISE") || upper.includes("REPLAN")) {
    return "revise";
  }
  // Default to continue
  return "continue";
}

// ── Stuck detection ────────────────────────────────────────────────────

function checkStuck(state: AutoLoopState): boolean {
  const recent = state.history.slice(-2);
  if (recent.length < 2) return false;

  const samePhase = recent[0].phase === recent[1].phase;
  const noNewFiles = recent[1].files.length === 0;

  if (samePhase && noNewFiles) {
    state.stuckCount++;
  } else {
    state.stuckCount = 0;
  }

  return state.stuckCount >= 2;
}

// ── Context formatting ─────────────────────────────────────────────────

function formatHistory(history: HistoryEntry[]): string {
  if (history.length === 0) return "No history yet.";
  return history
    .map(
      (h) =>
        `- Cycle ${h.cycle} [${h.phase}]: ${h.result}${h.files.length ? ` (files: ${h.files.join(", ")})` : ""}`
    )
    .join("\n");
}

function formatContext(ctx: LoopContext): string {
  const parts: string[] = [];
  if (ctx.keyFindings.length > 0) {
    parts.push(`Key findings: ${ctx.keyFindings.join("; ")}`);
  }
  if (ctx.openQuestions.length > 0) {
    parts.push(`Open questions: ${ctx.openQuestions.join("; ")}`);
  }
  if (ctx.blockers.length > 0) {
    parts.push(`Blockers: ${ctx.blockers.join("; ")}`);
  }
  return parts.length > 0 ? parts.join("\n") : "No context yet.";
}

// ── Extract file mentions from response text ───────────────────────────

function extractFiles(text: string): string[] {
  const files: string[] = [];
  // Match common file patterns: word.ext, path/to/file.ext
  const filePattern = /(?:^|\s)([\w./-]+\.(?:md|ts|js|json|yaml|yml|txt|csv))\b/gi;
  let match;
  while ((match = filePattern.exec(text)) !== null) {
    const file = match[1];
    // Skip overly generic matches
    if (file.length > 3 && !file.startsWith(".")) {
      files.push(file);
    }
  }
  return [...new Set(files)];
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input = parseInput(ctx.task);

  let state: AutoLoopState;
  let statePath: string;

  if (input.type === "inline") {
    state = createInitialState(input);
    statePath = getStatePath(state);
  } else {
    // Load from file
    if (!existsSync(input.path)) {
      return ctx.escalate(`State file not found: ${input.path}`, {
        path: input.path,
      });
    }
    state = loadState(input.path);
    statePath = input.path;
  }

  // Handle terminal states
  if (state.status === "done") {
    return ctx.done(
      `Auto-loop already complete: ${state.task}\n` +
        `Completed ${state.cycle} cycles. Task was already done.`
    );
  }

  if (state.status === "paused") {
    return ctx.escalate(
      `Auto-loop is paused: ${state.task}. Set status to "active" in the state file to resume.`,
      { statePath, state }
    );
  }

  if (state.status === "stuck") {
    return ctx.escalate(
      `Auto-loop is stuck: ${state.task}. Review the state file and fix the issue.`,
      { statePath, state }
    );
  }

  // Emit workflow start
  ctx.emit({
    type: "workflow_start",
    workflow: "auto-loop",
    task: state.task,
  });

  // ── Main loop ──────────────────────────────────────────────────────
  while (state.status === "active" && state.cycle <= state.maxCycles) {
    const cycleStart = Date.now();

    // ── Plan phase (cycle 1 only, or replan) ─────────────────────────
    if (state.phase === "plan") {
      ctx.emit({ type: "step_start", step: `cycle-${state.cycle}-plan` });

      const planTask =
        state.plan.length > 0
          ? `Revise the plan for: ${state.task}\n\n` +
            `Current plan: ${state.plan.join(", ")}\n\n` +
            `## History\n${formatHistory(state.history)}\n\n` +
            `## Context\n${formatContext(state.context)}\n\n` +
            `Create an updated plan given what we've learned.`
          : `Create a ${state.maxCycles}-cycle plan for: ${state.task}\n\n` +
            `Break this into ${state.maxCycles} concrete steps. ` +
            `Each step should produce a tangible output.`;

      const planResult = await ctx.runAgent(state.agent, planTask);

      if (planResult.status === "error") {
        state.status = "stuck";
        saveState(state, statePath);
        return ctx.escalate(
          `Auto-loop failed during plan phase: ${planResult.error ?? "agent error"}`,
          { statePath, state }
        );
      }

      const planText = planResult.lastAssistantText ?? "";

      // Extract plan items from the response
      const planItems = planText
        .split("\n")
        .filter((l) => /^\d+[\.\)]/.test(l.trim()))
        .map((l) => l.trim());

      if (planItems.length > 0) {
        state.plan = planItems;
      }

      const elapsed = `${Math.round((Date.now() - cycleStart) / 1000)}s`;
      state.history.push({
        cycle: state.cycle,
        phase: "plan",
        result: planText.slice(0, 500),
        files: extractFiles(planText),
        duration: elapsed,
      });

      state.phase = "execute";
      state.lastCycleAt = new Date().toISOString();
      saveState(state, statePath);
    }

    // ── Execute phase ────────────────────────────────────────────────
    if (state.phase === "execute") {
      ctx.emit({ type: "step_start", step: `cycle-${state.cycle}-execute` });

      const currentPlanItem =
        state.plan.length > 0
          ? state.plan[Math.min(state.cycle - 1, state.plan.length - 1)]
          : `Cycle ${state.cycle} of ${state.maxCycles}`;

      const executeTask =
        `Execute this step for: ${state.task}\n\n` +
        `## Current Step\n${currentPlanItem}\n\n` +
        `## Cycle\n${state.cycle} of ${state.maxCycles}\n\n` +
        `## History\n${formatHistory(state.history)}\n\n` +
        `## Context\n${formatContext(state.context)}`;

      let execResult = await ctx.runAgent(state.agent, executeTask);

      // Retry once on error
      if (execResult.status === "error") {
        execResult = await ctx.runAgent(state.agent, executeTask);
        if (execResult.status === "error") {
          state.status = "stuck";
          saveState(state, statePath);
          return ctx.escalate(
            `Auto-loop failed during execute phase after retry: ${execResult.error ?? "agent error"}`,
            { statePath, state }
          );
        }
      }

      const execText = execResult.lastAssistantText ?? "";
      const execElapsed = `${Math.round((Date.now() - cycleStart) / 1000)}s`;

      const filesProduced = extractFiles(execText);

      state.history.push({
        cycle: state.cycle,
        phase: "execute",
        result: execText.slice(0, 500),
        files: filesProduced,
        duration: execElapsed,
      });

      // Update context with any findings mentioned
      if (execText.toLowerCase().includes("finding") || execText.toLowerCase().includes("key")) {
        // Add a summary of this cycle's execution to key findings
        const finding = `Cycle ${state.cycle}: ${execText.slice(0, 200)}`;
        state.context.keyFindings.push(finding);
      }

      state.phase = "evaluate";
      state.lastCycleAt = new Date().toISOString();
      saveState(state, statePath);
    }

    // ── Evaluate phase ───────────────────────────────────────────────
    if (state.phase === "evaluate") {
      ctx.emit({ type: "step_start", step: `cycle-${state.cycle}-evaluate` });

      const evalTask =
        `Evaluate progress on: ${state.task}\n\n` +
        `## Completed\n${state.cycle} of ${state.maxCycles} cycles\n\n` +
        `## History\n${formatHistory(state.history)}\n\n` +
        `## Context\n${formatContext(state.context)}\n\n` +
        `Decide one of:\n` +
        `- "Decision: DONE" — task is complete, no more cycles needed\n` +
        `- "Decision: CONTINUE" — continue to next cycle\n` +
        `- "REVISE" / "REPLAN" — current plan isn't working, need a new approach`;

      const evalResult = await ctx.runAgent(state.agent, evalTask);
      const evalText = evalResult.lastAssistantText ?? "";
      const evalElapsed = `${Math.round((Date.now() - cycleStart) / 1000)}s`;

      state.history.push({
        cycle: state.cycle,
        phase: "evaluate",
        result: evalText.slice(0, 500),
        files: extractFiles(evalText),
        duration: evalElapsed,
      });

      // Check for stuck BEFORE processing the decision
      if (checkStuck(state)) {
        state.status = "stuck";
        saveState(state, statePath);
        return ctx.escalate(
          `Auto-loop stuck at cycle ${state.cycle}, phase evaluate. ` +
            `Same phase repeated with no new output.`,
          { statePath, state }
        );
      }

      const decision = extractDecision(evalText);

      if (decision === "done") {
        state.status = "done";
        state.phase = "done";
        saveState(state, statePath);
        return ctx.done(
          `Auto-loop complete: ${state.task}\n\n` +
            `Completed ${state.cycle} of ${state.maxCycles} cycles.\n\n` +
            `## Summary\n${evalText}`
        );
      }

      if (decision === "revise") {
        // Go back to plan phase without bumping cycle
        state.phase = "plan";
        state.lastCycleAt = new Date().toISOString();
        saveState(state, statePath);
        continue;
      }

      // CONTINUE — bump cycle and go to execute
      state.cycle++;
      state.phase = "execute";
      state.lastCycleAt = new Date().toISOString();
      saveState(state, statePath);

      // Check if we've exceeded max cycles
      if (state.cycle > state.maxCycles) {
        state.status = "done";
        state.phase = "done";
        saveState(state, statePath);
        return ctx.done(
          `Auto-loop complete (max cycles reached): ${state.task}\n\n` +
            `Completed ${state.maxCycles} of ${state.maxCycles} cycles.\n\n` +
            `## Last Evaluation\n${evalText}`
        );
      }
    }
  }

  // Shouldn't normally get here, but handle gracefully
  state.status = "done";
  state.phase = "done";
  saveState(state, statePath);
  return ctx.done(
    `Auto-loop complete: ${state.task}\n\n` +
      `Completed ${state.cycle} cycles.`
  );
}
