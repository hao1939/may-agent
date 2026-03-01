import type { TaskResult } from "./types.js";

// ── Workflow Events ────────────────────────────────────────────────────

export type WorkflowEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_start"; step: string; sessionId?: string }
  | { type: "step_done"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow_done"; summary: string }
  | { type: "workflow_escalate"; reason: string };

// ── Workflow Result ────────────────────────────────────────────────────

export type WorkflowResult =
  | { type: "done"; summary: string }
  | { type: "escalate"; reason: string; context?: unknown };

// ── Workflow Context ───────────────────────────────────────────────────

/** Provided to each workflow's execute() function. */
export interface WorkflowContext {
  /** The original task. */
  task: string;

  /** Run a sub-agent, wait for it to finish, return result.
   *  Checks the steering queue before each step — if a steering signal
   *  is pending, throws WorkflowInterrupted. */
  runAgent(name: string, task: string): Promise<TaskResult>;

  /** Run a sub-workflow by name. Enables workflow composition. */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;

  /** Emit a workflow event (observable by subscribers). */
  emit(event: WorkflowEvent): void;

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
  ) {
    super(`Workflow interrupted: ${steeringMessage}`);
    this.name = "WorkflowInterrupted";
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
  | { type: "escalated"; workflow: string; workflowRunId: string; reason: string; context?: unknown; steps: WorkflowStepSummary[] }
  | { type: "interrupted"; workflow: string; workflowRunId: string; completedSteps: CompletedStep[]; steeringMessage: string }
  | { type: "error"; workflow: string; error: string }
  | { type: "list"; workflows: Array<{ name: string; description: string }> };

/** Compact summary of a workflow step — included in the tool result so the supervisor
 *  can see what happened without calling trace(). */
export interface WorkflowStepSummary {
  agent: string;
  sessionId: string;
  status: "done" | "error";
  /** Truncated key output. */
  output: string;
  duration: string;
}
