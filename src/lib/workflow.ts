import type { TaskResult } from "./types.js";
import type { HandoffOptions } from "./handoff.js";

// ── Workflow Events ────────────────────────────────────────────────────

export type WorkflowEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_start"; step: string; sessionId?: string }
  | { type: "step_done"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow_done"; summary: string }
  | { type: "workflow_escalate"; reason: string };

// ── Guard Events (workflow-level) ──────────────────────────────────────

/** Events the workflow runtime emits. Guards subscribe to these. */
export type WorkflowGuardEvent =
  | { type: "step_done"; source: "agent" | "function"; step: string; result: TaskResult; completedSteps: CompletedStep[]; task: string }
  | { type: "step_start"; source: "agent" | "function"; step: string; task: string; completedSteps: CompletedStep[] }
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "workflow_done"; workflow: string; summary: string; completedSteps: CompletedStep[] };

// ── Guard Types ────────────────────────────────────────────────────────

/** A demand returned by a guard in response to a workflow event. */
export interface Demand {
  type: "run_step" | "block" | "warn";
  /** Human-readable reason. Included in logs, warnings, and block messages. */
  reason: string;
  /** Name of the guard that produced this demand. Auto-filled by runtime. */
  guardName?: string;
  /** For run_step: the step to inject. */
  step?: {
    agent: string;
    task: string;
    label?: string;
  };
}

/** A guard is a pure event listener: event in → demands out. */
export interface WorkflowGuard {
  name: string;
  /** Which events this guard listens to. If omitted, listens to all. */
  events?: WorkflowGuardEvent["type"][];
  /** Expected cost tier of injected steps. For monitoring/alerting. */
  costTier?: "zero" | "low" | "medium";
  /** Receive an event, return demands (or empty array). Must be pure (no I/O). */
  handle(event: WorkflowGuardEvent): Demand[];
}

/** Guard module file shape — each guard .ts file exports this. */
export interface GuardModule {
  guard: WorkflowGuard;
}

// ── Workflow Result ────────────────────────────────────────────────────

/** The outcome of a workflow execution — either successful completion with a summary, or an escalation with a reason. */
export type WorkflowResult =
  | { type: "done"; summary: string }
  | { type: "escalate"; reason: string; context?: unknown };

// ── Workflow Context ───────────────────────────────────────────────────

/** Provided to each workflow's execute() function. */
export interface WorkflowContext {
  /** The original task. */
  task: string;

  /** The name of the agent that called this workflow.
   *  Use this instead of hardcoding agent names in shared workflows. */
  agent: string;

  /** Run a sub-agent, wait for it to finish, return result.
   *  Checks the steering queue before each step — if a steering signal
   *  is pending, throws WorkflowInterrupted.
   *  @throws {WorkflowInterrupted} If a steering signal is received while the agent is running.
   */
  runAgent(name: string, task: string): Promise<TaskResult>;

  /** Run a sub-workflow by name. Enables workflow composition. */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;

  /** Run a JS function as a workflow step. No LLM cost.
   *  Returns a TaskResult-like object with the function's output.
   *  Timeout: 30s. Output truncated to 50KB. */
  runFunction(label: string, fn: () => Promise<string>): Promise<TaskResult>;

  /** Emit a workflow event (observable by subscribers). */
  emit(event: WorkflowEvent): void;

  /**
   * Build a rich context summary from a completed TaskResult for step handoff.
   *
   * Instead of passing just `result.lastAssistantText` to the next step,
   * use this to give it structured context about files modified, commands run,
   * errors encountered, and the agent's final assessment.
   *
   * Example:
   * ```ts
   * const coder = await ctx.runAgent("coder", ctx.task);
   * const reviewTask = `Review this implementation.\n\n` +
   *   `## Task\n${ctx.task}\n\n` +
   *   `## Implementation Summary\n${ctx.summarize(coder)}`;
   * const review = await ctx.runAgent("reviewer", reviewTask);
   * ```
   */
  summarize(result: TaskResult, opts?: HandoffOptions): string;

  /** Mark workflow as done. */
  done(summary: string): WorkflowResult;

  /** Escalate — workflow can't handle this, return to agent (slow mode). */
  escalate(reason: string, context?: unknown): WorkflowResult;
}

// ── Workflow Module ────────────────────────────────────────────────────

/** Shape of a loaded workflow .ts file. */
export interface WorkflowModule {
  name: string;
  description: string;
  execute: (ctx: WorkflowContext) => Promise<WorkflowResult>;
}

// ── Workflow Interrupted ───────────────────────────────────────────────

export interface CompletedStep {
  step: string;
  sessionId?: string;
  result: TaskResult;
}

/** Thrown when a steering signal interrupts a running workflow. */
export class WorkflowInterrupted extends Error {
  constructor(
    public readonly steeringMessage: string,
    public readonly completedSteps: CompletedStep[],
    public readonly workflowRunId: string = "unknown",
  ) {
    super(`Workflow interrupted: ${steeringMessage}`);
    this.name = "WorkflowInterrupted";
  }
}

/** Thrown when a guard blocks a workflow with a hard-stop demand. */
export class WorkflowBlocked extends Error {
  constructor(
    public readonly reason: string,
    public readonly completedSteps: CompletedStep[],
    public readonly workflowRunId: string,
  ) {
    super(`Workflow blocked by guard: ${reason}`);
    this.name = "WorkflowBlocked";
  }
}

// ── Session Trace ──────────────────────────────────────────────────────

/** A node in the session tree — either a workflow run or a session. */
export interface TraceNode {
  type: "workflow" | "session";
  id: string;
  label: string;
  status: string;
  task: string;
  depth: number;
  /** true for the session/workflow that was queried */
  isTarget: boolean;
  children: TraceNode[];
}

/** Full trace result — the session tree from any node. */
export interface SessionTrace {
  /** The queried session or workflow run ID. */
  targetId: string;
  /** Path from root to target: ["wr_1/diagnose-and-fix", "wr_2/implement-and-review", "s_3/reviewer"] */
  path: string[];
  /** The full tree. */
  tree: TraceNode;
}

// ── Workflow Tool Result Types ─────────────────────────────────────────

export type WorkflowToolResult =
  | { type: "done"; workflow: string; workflowRunId: string; summary: string; steps: WorkflowStepSummary[] }
  | {
      type: "escalated";
      workflow: string;
      workflowRunId: string;
      reason: string;
      context?: unknown;
      steps: WorkflowStepSummary[];
    }
  | {
      type: "blocked";
      workflow: string;
      workflowRunId: string;
      reason: string;
      completedSteps: CompletedStep[];
    }
  | {
      type: "interrupted";
      workflow: string;
      workflowRunId: string;
      completedSteps: CompletedStep[];
      steeringMessage: string;
    }
  | { type: "error"; workflow: string; error: string }
  | { type: "list"; workflows: Array<{ name: string; description: string }> };

/** Compact summary of a workflow step — included in the tool result so the supervisor
 *  can see what happened without calling trace(). */
export interface WorkflowStepSummary {
  agent: string;
  sessionId: string;
  status: "done" | "error" | "interrupted";
  /** Truncated key output. */
  output: string;
  duration: string;
}
