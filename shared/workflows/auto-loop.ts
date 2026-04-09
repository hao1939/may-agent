/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * auto-loop — Multi-cycle autonomous execution workflow.
 *
 * Reads a YAML state file that defines a task, then runs cycles of
 * plan → execute → evaluate until the task is done, stuck, or maxCycles
 * is reached.
 *
 * Designed to be kicked off by a heartbeat and then run to completion
 * autonomously — no waiting for the next heartbeat between cycles.
 *
 * Input format:
 *   The input is the path to a YAML state file, e.g.:
 *     agents/bob/workspace/auto-loop/h089-research.yaml
 *
 *   OR an inline task with metadata:
 *     agent: bob
 *     maxCycles: 5
 *     task: Research hypothesis H-089 across 5 experiments
 *
 * State file schema (YAML):
 *   task: "Research hypothesis H-089"
 *   agent: "bob"                    # which agent runs each cycle
 *   phase: "plan"                   # plan | execute | evaluate | done
 *   cycle: 1
 *   maxCycles: 5
 *   status: "active"               # active | paused | done | stuck
 *   stuckCount: 0
 *   created: "2026-04-08T12:00:00Z"
 *   lastCycleAt: null
 *   plan: []                        # ordered list of cycle goals
 *   history: []                     # completed cycle results
 *   context:                        # carried forward each cycle
 *     keyFindings: []
 *     openQuestions: []
 *     blockers: []
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

interface AutoLoopState {
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
  history: CycleRecord[];
  context: {
    keyFindings: string[];
    openQuestions: string[];
    blockers: string[];
  };
}

interface CycleRecord {
  cycle: number;
  phase: string;
  result: string;
  files: string[];
  duration: string;
}

// ── YAML helpers (minimal, no dependency) ──────────────────────────────

function parseYaml(text: string): Record<string, any> {
  // Simple YAML parser for our specific schema.
  // Handles: scalars, arrays (inline and block), nested objects.
  // For robustness, we use JSON embedded in YAML where complex structures needed.
  try {
    // Try JSON first (state files are saved as JSON-in-YAML-compatible format)
    return JSON.parse(text);
  } catch {
    // Fall back to basic YAML-like parsing
    const result: Record<string, any> = {};
    const lines = text.split("\n");
    let currentKey = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        if (value === "" || value === "[]" || value === "null") {
          result[key] = value === "[]" ? [] : value === "null" ? null : "";
          currentKey = key;
        } else if (value === "{}") {
          result[key] = {};
          currentKey = key;
        } else if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value === "true" || value === "false") {
          result[key] = value === "true";
        } else if (!isNaN(Number(value))) {
          result[key] = Number(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
}

function serializeState(state: AutoLoopState): string {
  return JSON.stringify(state, null, 2);
}

// ── State management ───────────────────────────────────────────────────

function loadState(path: string): AutoLoopState {
  const text = readFileSync(path, "utf-8");
  const raw = parseYaml(text);

  return {
    task: raw.task ?? "unknown task",
    agent: raw.agent ?? "bob",
    phase: raw.phase ?? "plan",
    cycle: raw.cycle ?? 1,
    maxCycles: raw.maxCycles ?? 5,
    status: raw.status ?? "active",
    stuckCount: raw.stuckCount ?? 0,
    created: raw.created ?? new Date().toISOString(),
    lastCycleAt: raw.lastCycleAt ?? null,
    plan: raw.plan ?? [],
    history: raw.history ?? [],
    context: raw.context ?? { keyFindings: [], openQuestions: [], blockers: [] },
  };
}

function saveState(path: string, state: AutoLoopState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeState(state), "utf-8");
}

function createInitialState(agent: string, task: string, maxCycles: number): AutoLoopState {
  return {
    task,
    agent,
    phase: "plan",
    cycle: 1,
    maxCycles,
    status: "active",
    stuckCount: 0,
    created: new Date().toISOString(),
    lastCycleAt: null,
    plan: [],
    history: [],
    context: { keyFindings: [], openQuestions: [], blockers: [] },
  };
}

// ── Stuck detection ────────────────────────────────────────────────────

function checkStuck(state: AutoLoopState): boolean {
  const recent = state.history.slice(-2);
  if (recent.length < 2) return false;

  // Same phase repeated with no new files produced
  const samePhase = recent[0].phase === recent[1].phase;
  const noNewFiles = recent[1].files.length === 0;

  if (samePhase && noNewFiles) {
    state.stuckCount++;
  } else {
    state.stuckCount = 0;
  }

  return state.stuckCount >= 2;
}

// ── Context summarization ──────────────────────────────────────────────

function summarizeHistory(history: CycleRecord[]): string {
  if (history.length === 0) return "(no previous cycles)";
  return history
    .map((h) => `Cycle ${h.cycle} [${h.phase}]: ${h.result}${h.files.length ? ` (files: ${h.files.join(", ")})` : ""}`)
    .join("\n");
}

function summarizeContext(ctx: AutoLoopState["context"]): string {
  const parts: string[] = [];
  if (ctx.keyFindings.length) parts.push(`Key findings: ${ctx.keyFindings.join("; ")}`);
  if (ctx.openQuestions.length) parts.push(`Open questions: ${ctx.openQuestions.join("; ")}`);
  if (ctx.blockers.length) parts.push(`Blockers: ${ctx.blockers.join("; ")}`);
  return parts.length ? parts.join("\n") : "(no accumulated context)";
}

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  statePath: string | null;
  agent: string;
  task: string;
  maxCycles: number;
}

function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim();

  // If the input looks like a file path to a YAML/JSON file
  if (
    (trimmed.endsWith(".yaml") || trimmed.endsWith(".yml") || trimmed.endsWith(".json")) &&
    !trimmed.includes("\n")
  ) {
    return { statePath: trimmed, agent: "", task: "", maxCycles: 5 };
  }

  // Inline task format
  const agentMatch = trimmed.match(/^agent:\s*(.+)$/m);
  const maxCyclesMatch = trimmed.match(/^maxCycles:\s*(\d+)$/m);
  const taskMatch = trimmed.match(/^task:\s*(.+)$/m);

  const agent = agentMatch?.[1]?.trim() ?? "bob";
  const maxCycles = maxCyclesMatch ? parseInt(maxCyclesMatch[1], 10) : 5;
  const task = taskMatch?.[1]?.trim() ?? trimmed
    .replace(/^agent:\s*.+$/m, "")
    .replace(/^maxCycles:\s*\d+$/m, "")
    .trim();

  return { statePath: null, agent, task, maxCycles };
}

// ── Response parsing (extract structured info from agent output) ──────

function extractFiles(text: string): string[] {
  // Match file paths mentioned in agent output — multiple patterns for robustness
  const files: string[] = [];
  const patterns = [
    /(?:created|wrote|modified|updated|saved|generated|produced)\s+[`"]?([^\s`"]+\.\w{1,6})[`"]?/gi,
    /(?:file|output|report|deliverable|path):\s*[`"]?([^\s`"]+\.\w{1,6})[`"]?/gi,
    // Backtick-wrapped paths (common in markdown)
    /`((?:agents|src|test|\.state)\/[^\s`]+\.\w{1,6})`/g,
    // "path" in finish() deliverables format
    /"path"\s*:\s*"([^"]+\.\w{1,6})"/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && !files.includes(match[1])) {
        files.push(match[1]);
      }
    }
  }
  return files;
}

/** Extract file paths from TaskResult messages (looks at finish() tool calls and write() calls). */
function extractFilesFromResult(result: { messages?: any[]; lastAssistantText?: string | null }): string[] {
  const files: string[] = [];
  const text = result.lastAssistantText ?? "";
  files.push(...extractFiles(text));

  // Also scan messages for write/edit tool calls and finish deliverables
  if (result.messages) {
    for (const msg of result.messages) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "tool_use") {
            // write() and edit() have a "path" parameter
            if ((block.name === "write" || block.name === "edit") && block.input?.path) {
              if (!files.includes(block.input.path)) files.push(block.input.path);
            }
            // finish() has deliverables array
            if (block.name === "finish" && block.input?.deliverables) {
              for (const d of block.input.deliverables) {
                if (d.path && !files.includes(d.path)) files.push(d.path);
              }
            }
          }
        }
      }
    }
  }
  return files;
}

function extractDecision(text: string): "continue" | "revise" | "done" {
  const lower = text.toLowerCase();

  // Explicit signals
  if (lower.includes("##") && lower.includes("done")) return "done";
  if (lower.includes("task complete") || lower.includes("all cycles complete")) return "done";
  if (lower.includes("revise plan") || lower.includes("need to revise") || lower.includes("replanning")) return "revise";

  // Check for DONE/CONTINUE/REVISE markers
  if (/\b(decision|verdict|status)\s*:\s*done\b/i.test(text)) return "done";
  if (/\b(decision|verdict|status)\s*:\s*revise\b/i.test(text)) return "revise";

  return "continue";
}

function extractKeyFindings(text: string): string[] {
  const findings: string[] = [];
  
  // Multiple patterns for finding sections
  const sectionPatterns = [
    /(?:key findings?|main findings?|discovered|found that|results?|conclusions?)[:\s]*\n((?:[-*•]\s*.+\n?)+)/gi,
    /(?:key findings?|main findings?|discovered|found that)[:\s]*(.+?)(?:\n\n|\n#|$)/is,
    // Numbered findings
    /(?:key findings?|main findings?)[:\s]*\n((?:\d+[.)]\s*.+\n?)+)/gi,
  ];
  
  for (const pattern of sectionPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const items = match[1]
        .split(/\n(?:[-*•]\s*|\d+[.)]\s*)/)
        .filter(Boolean)
        .map(i => i.trim())
        .filter(i => i.length > 10)
        .slice(0, 5);
      findings.push(...items);
      if (findings.length > 0) break;
    }
  }
  
  // Fallback: extract from summary/executive sections
  if (findings.length === 0) {
    const summaryMatch = text.match(/(?:executive summary|summary|tldr|tl;dr)[:\s]*\n(.+?)(?:\n\n|\n##|$)/is);
    if (summaryMatch?.[1]) {
      findings.push(summaryMatch[1].trim().slice(0, 200));
    }
  }
  
  return findings;
}

// ── Workflow metadata ──────────────────────────────────────────────────

export const name: string = "auto-loop";

export const description: string =
  "Multi-cycle autonomous execution: reads a YAML state file (or inline task), " +
  "runs plan→execute→evaluate cycles until done or stuck. " +
  "Designed for research, multi-experiment, and iterative tasks.";

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Parse input
  const input = parseInput(ctx.task);

  let statePath: string;
  let state: AutoLoopState;

  if (input.statePath) {
    // Load from existing state file
    statePath = resolve(input.statePath);
    if (!existsSync(statePath)) {
      return ctx.escalate(`State file not found: ${input.statePath}`, {
        hint: "Create the state file first, or use inline format: agent: <name>\\ntask: <description>",
      });
    }
    state = loadState(statePath);
  } else {
    // Create from inline task — generate state file path
    const safeTaskId = input.task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/-$/, "");
    statePath = resolve(`agents/${input.agent}/workspace/auto-loop/${safeTaskId}.json`);

    if (existsSync(statePath)) {
      // Resume existing loop
      state = loadState(statePath);
    } else {
      // Create new loop
      state = createInitialState(input.agent, input.task, input.maxCycles);
      saveState(statePath, state);
    }
  }

  // Check if already done or paused
  if (state.status === "done") {
    return ctx.done(
      `## Auto-loop already complete\n\n` +
      `Task: ${state.task}\n` +
      `Cycles used: ${state.cycle - 1}/${state.maxCycles}\n` +
      `History:\n${summarizeHistory(state.history)}`
    );
  }
  if (state.status === "paused") {
    return ctx.escalate("Auto-loop is paused — set status to 'active' in the state file to resume", {
      statePath,
      state,
    });
  }

  ctx.emit({ type: "workflow_start", workflow: "auto-loop", task: state.task });

  // ── Main loop ──────────────────────────────────────────────────────
  while (state.status === "active" && state.cycle <= state.maxCycles) {
    const cycleStart = Date.now();
    ctx.emit({ type: "step_start", step: `cycle-${state.cycle}-${state.phase}` });

    // ── PLAN phase ─────────────────────────────────────────────────
    if (state.phase === "plan") {
      const planTask = state.plan.length === 0
        ? `## Task: Create a research/execution plan\n\n` +
          `Goal: ${state.task}\n` +
          `Budget: ${state.maxCycles} cycles\n\n` +
          `${state.history.length > 0 ? `## Previous work\n${summarizeHistory(state.history)}\n\n` : ""}` +
          `${summarizeContext(state.context) !== "(no accumulated context)" ? `## Context\n${summarizeContext(state.context)}\n\n` : ""}` +
          `Create a concrete ${state.maxCycles}-step plan. For each step, describe what to do and what the expected output is.\n\n` +
          `Format your plan as a numbered list, one step per cycle.`
        : `## Task: Revise the plan\n\n` +
          `Goal: ${state.task}\n` +
          `Original plan:\n${state.plan.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n` +
          `## What happened\n${summarizeHistory(state.history)}\n\n` +
          `## Context\n${summarizeContext(state.context)}\n\n` +
          `Revise the plan based on what we've learned. Keep remaining cycles realistic.`;

      const planResult = await ctx.runAgent(state.agent, planTask);
      if (planResult.status === "error") {
        state.status = "stuck";
        state.context.blockers.push(`Plan phase failed: ${planResult.error}`);
        saveState(statePath, state);
        return ctx.escalate(`Agent failed during plan phase (cycle ${state.cycle})`, {
          error: planResult.error,
          statePath,
        });
      }

      // Extract plan from agent output — try multiple formats
      const planText = planResult.lastAssistantText ?? "";
      let planLines = planText
        .split("\n")
        // Match: "1.", "1)", "Step 1:", "**1.", "- Step 1:"
        .filter((l) => /^\s*(?:\*\*)?(?:step\s+)?\d+[.):\s]/i.test(l))
        .map((l) => l.replace(/^\s*(?:\*\*)?(?:step\s+)?\d+[.):\s]*\**\s*/i, "").trim())
        .filter(Boolean);
      
      // Fallback: try bullet points if no numbered items found
      if (planLines.length === 0) {
        planLines = planText
          .split("\n")
          .filter((l) => /^\s*[-*•]\s/.test(l))
          .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
          .filter((l) => l.length > 10)
          .slice(0, 10);
      }

      if (planLines.length > 0) {
        state.plan = planLines;
      }

      state.history.push({
        cycle: state.cycle,
        phase: "plan",
        result: planLines.length > 0 ? `Created ${planLines.length}-step plan` : "Plan created (unstructured)",
        files: extractFiles(planText),
        duration: `${Math.round((Date.now() - cycleStart) / 1000)}s`,
      });

      state.phase = "execute";
      state.lastCycleAt = new Date().toISOString();
      saveState(statePath, state);
      continue;
    }

    // ── EXECUTE phase ──────────────────────────────────────────────
    if (state.phase === "execute") {
      const currentPlanItem = state.plan[state.cycle - 1] ?? `Cycle ${state.cycle} of: ${state.task}`;

      const execTask =
        `## Task: Execute this step\n\n` +
        `Overall goal: ${state.task}\n` +
        `Current step (${state.cycle}/${state.maxCycles}): ${currentPlanItem}\n\n` +
        `## Previous work\n${summarizeHistory(state.history)}\n\n` +
        `## Context\n${summarizeContext(state.context)}\n\n` +
        `Execute this step. Be thorough. Produce concrete outputs (files, analyses, results).\n` +
        `When done, summarize what you accomplished and what files you created or modified.`;

      const execResult = await ctx.runAgent(state.agent, execTask);
      if (execResult.status === "error") {
        // One retry on transient errors
        const retry = await ctx.runAgent(state.agent, execTask);
        if (retry.status === "error") {
          state.status = "stuck";
          state.context.blockers.push(`Execute phase failed: ${retry.error}`);
          saveState(statePath, state);
          return ctx.escalate(`Agent failed during execute phase (cycle ${state.cycle})`, {
            error: retry.error,
            statePath,
          });
        }
      }

      const execText = (execResult.status === "error" ? "" : execResult.lastAssistantText) ?? "";
      const files = extractFilesFromResult(execResult);
      const findings = extractKeyFindings(execText);
      if (findings.length) {
        state.context.keyFindings.push(...findings);
      }

      state.history.push({
        cycle: state.cycle,
        phase: "execute",
        result: execText.slice(0, 800),
        files,
        duration: `${Math.round((Date.now() - cycleStart) / 1000)}s`,
      });

      state.phase = "evaluate";
      state.lastCycleAt = new Date().toISOString();
      saveState(statePath, state);
      continue;
    }

    // ── EVALUATE phase ─────────────────────────────────────────────
    if (state.phase === "evaluate") {
      const evalTask =
        `## Task: Evaluate progress\n\n` +
        `Overall goal: ${state.task}\n` +
        `Completed: ${state.cycle}/${state.maxCycles} cycles\n\n` +
        `## Full history\n${summarizeHistory(state.history)}\n\n` +
        `## Accumulated context\n${summarizeContext(state.context)}\n\n` +
        `## Current plan\n${state.plan.map((p, i) => `${i + 1}. ${p}${i < state.cycle ? " ✅" : ""}`).join("\n")}\n\n` +
        `Evaluate the progress so far. Decide ONE of:\n` +
        `- **CONTINUE**: Good progress, move to next cycle\n` +
        `- **REVISE**: Plan needs adjustment based on what we learned\n` +
        `- **DONE**: The goal has been achieved, no more cycles needed\n\n` +
        `State your decision clearly. If CONTINUE or REVISE, explain what should change. ` +
        `If DONE, provide a final summary of results.`;

      const evalResult = await ctx.runAgent(state.agent, evalTask);
      const evalText = evalResult.lastAssistantText ?? "";
      const decision = extractDecision(evalText);

      state.history.push({
        cycle: state.cycle,
        phase: "evaluate",
        result: `Decision: ${decision}. ${evalText.slice(0, 300)}`,
        files: [],
        duration: `${Math.round((Date.now() - cycleStart) / 1000)}s`,
      });

      if (decision === "done") {
        state.status = "done";
        state.phase = "done";
        state.lastCycleAt = new Date().toISOString();
        saveState(statePath, state);

        return ctx.done(
          `## Auto-loop complete ✅\n\n` +
          `**Task**: ${state.task}\n` +
          `**Cycles used**: ${state.cycle}/${state.maxCycles}\n` +
          `**Agent**: ${state.agent}\n\n` +
          `## Final evaluation\n${evalText}\n\n` +
          `## Cycle history\n${summarizeHistory(state.history)}\n\n` +
          `## Key findings\n${state.context.keyFindings.length ? state.context.keyFindings.map(f => `- ${f}`).join("\n") : "(none recorded)"}\n\n` +
          `**State file**: ${statePath}`
        );
      }

      if (decision === "revise") {
        state.phase = "plan";  // Go back to planning
      } else {
        state.phase = "execute";  // Continue to next cycle
        state.cycle++;
      }

      state.lastCycleAt = new Date().toISOString();
      saveState(statePath, state);

      // Stuck detection
      if (checkStuck(state)) {
        state.status = "stuck";
        saveState(statePath, state);
        return ctx.escalate(
          `Auto-loop stuck at cycle ${state.cycle}, phase ${state.phase}. ` +
          `Same phase repeated with no progress for ${state.stuckCount} cycles.`,
          { statePath, history: state.history.slice(-3) }
        );
      }

      continue;
    }
  }

  // maxCycles exhausted
  if (state.cycle > state.maxCycles) {
    state.status = "done";
    saveState(statePath, state);
    return ctx.done(
      `## Auto-loop finished (max cycles reached)\n\n` +
      `**Task**: ${state.task}\n` +
      `**Cycles used**: ${state.maxCycles}/${state.maxCycles}\n` +
      `**Agent**: ${state.agent}\n\n` +
      `## Cycle history\n${summarizeHistory(state.history)}\n\n` +
      `## Key findings\n${state.context.keyFindings.length ? state.context.keyFindings.map(f => `- ${f}`).join("\n") : "(none recorded)"}\n\n` +
      `**State file**: ${statePath}`
    );
  }

  // Shouldn't reach here, but handle gracefully
  saveState(statePath, state);
  return ctx.escalate("Auto-loop exited unexpectedly", { statePath, state });
}
