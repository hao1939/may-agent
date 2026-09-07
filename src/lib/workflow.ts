import type { TaskResult } from "./types.js";
import type { WorkflowContext, ExecutionResult } from "@may-agent/sdk";
export type { WorkflowContext } from "@may-agent/sdk";
import type {
  Demand as SdkDemand,
  GuardModule as SdkGuardModule,
  WorkflowGuard as SdkWorkflowGuard,
  WorkflowGuardEvent as SdkWorkflowGuardEvent,
} from "@may-agent/sdk";

// ── Workflow Lifecycle Callback Events ────────────────────────────────
// These are local workflow-tool callbacks for logs/guards. They are not
// SystemEvent bus envelopes unless code explicitly emits them via ctx.events.emit().

export type WorkflowEvent =
  | { type: "workflow.started"; workflow: string; task: string }
  | { type: "workflow.step_started"; step: string; sessionId?: string }
  | { type: "workflow.step_completed"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow.completed"; summary: string }
  | { type: "workflow.blocked"; reason: string }
  | { type: "workflow.interrupted"; reason?: string }
  | {
      type: "workflow.resume_failed";
      source: string;
      owner: string;
      timestamp: number;
      data: {
        workflowRunId?: string;
        workflow?: string;
        reason: string;
        category: string;
        recoverable: boolean;
        nextAction?: string;
        projectId?: string;
      };
    }
  | {
      type: "workflow.resume_skipped";
      source: string;
      owner: string;
      timestamp: number;
      data: {
        workflowRunId: string;
        workflow: string;
        status: string;
        reason: string;
        nextAction?: string;
        projectId?: string;
      };
    };

// ── Guard Events (workflow-level) ──────────────────────────────────────

/** Events the workflow runtime emits. Guards subscribe to these. */
export type WorkflowGuardEvent = SdkWorkflowGuardEvent<TaskResult>;

// ── Guard Types ────────────────────────────────────────────────────────

/** A demand returned by a guard in response to a workflow event. */
export type Demand = SdkDemand;

/** A guard is a pure event listener: event in → demands out. */
export type WorkflowGuard = SdkWorkflowGuard<TaskResult>;

/** Guard module file shape — each guard .ts file exports this. */
export type GuardModule = SdkGuardModule<TaskResult>;

// ── Workflow Result ────────────────────────────────────────────────────

/** The outcome of a workflow execution. */
export type WorkflowResult =
  { type: "done"; summary: string; output?: unknown } | { type: "blocked"; reason: string; context?: unknown };

// ── Workflow Module ────────────────────────────────────────────────────

/** Shape of a loaded workflow .ts file. */
export interface WorkflowModule {
  name: string;
  description: string;
  /** Optional bounded wall-clock budget for workflows that run long evaluations. */
  executionTimeoutMs?: number;
  /** Filesystem isolation convention interpreted by the embedding app runtime. */
  workspace?: "shared" | "task" | { kind: "task"; baseBranch: string };
  execute: (ctx: WorkflowContext) => Promise<ExecutionResult>;
  /** Optional app-level deterministic verifier; interpreted by the embedding infrastructure. */
  verify?: (context: unknown, result: unknown) => Promise<unknown>;
  /** Immutable provenance captured when the catalog snapshot was built. */
  sourcePath: string;
  sourceScope: "agent" | "project";
  entryContentHash: string;
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
  | {
      type: "done";
      workflow: string;
      workflowRunId: string;
      summary: string;
      output?: unknown;
      steps: WorkflowStepSummary[];
    }
  | {
      type: "blocked";
      workflow: string;
      workflowRunId: string;
      reason: string;
      context?: unknown;
      steps?: WorkflowStepSummary[];
      completedSteps?: CompletedStep[];
    }
  | {
      type: "interrupted";
      workflow: string;
      workflowRunId: string;
      completedSteps: CompletedStep[];
      steeringMessage: string;
    }
  | { type: "error"; workflow?: string; workflowRunId?: string; error: string; reason?: string; category?: string }
  | {
      type: "list";
      workflows: Array<{ name: string; description: string; sourceScope?: "agent" | "project" }>;
      diagnostics?: string[];
    };

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
