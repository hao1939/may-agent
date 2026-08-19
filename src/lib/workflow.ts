import type { FinishResult, TaskResult } from "./types.js";
import type { HandoffOptions } from "./handoff.js";
import type { MetricService } from "./metrics.js";
import type { QueryAPI } from "./query-service.js";
import type { CommandAPI } from "./command-service.js";
import type { Static, TSchema } from "@earendil-works/pi-ai";
import type {
  Demand as SdkDemand,
  GuardModule as SdkGuardModule,
  WorkflowGuard as SdkWorkflowGuard,
  WorkflowGuardEvent as SdkWorkflowGuardEvent,
} from "@may-agent/sdk";

// ── Workflow Lifecycle Callback Events ────────────────────────────────
// These are local workflow-tool callbacks for logs/guards. They are not
// SystemEvent bus envelopes unless code explicitly emits them via ctx.emit().

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

export interface WorkflowAgentOptions<S extends TSchema = TSchema> {
  timeoutMs?: number;
  /** Finite positive integer tool-operation allowance before bounded completion is requested. */
  operationAllowance?: number;
  /** Exact source classification persisted on the step session. */
  source?: string;
  /** Restrict this agent step to observation tools plus finish(). */
  tools?: "full" | "readonly";
  /** Explicit skill used by this workflow step. */
  skill?: string;
  /** Workflow-author-defined schema for finish().result. */
  schema?: S;
}

export type WorkflowAgentTaskResult =
  | (TaskResult & { status: "done"; finishResult: FinishResult })
  | (TaskResult & { status: "error" | "interrupted"; finishResult?: FinishResult });

export type SchemaBackedTaskResult<S extends TSchema> =
  | (WorkflowAgentTaskResult & { status: "done"; structuredResult: Static<S> })
  | (TaskResult & { status: "error" | "interrupted"; structuredResult?: Static<S> });

// ── Workflow Context ───────────────────────────────────────────────────

/** Provided to each workflow's execute() function. */
export interface WorkflowContext {
  /** The original task. */
  task: string;

  /** The name of the agent that called this workflow.
   *  Use this instead of hardcoding agent names in reusable workflow code. */
  agent: string;

  // ── RuntimeCtx (shared infra) ──────────────────────────────────────

  /** Emit a runtime event on the bus. Dot-named domain events are wrapped as canonical envelopes. */
  emit(event: { type: string; [key: string]: unknown }): void;

  /** Dispatch an agent-level event to handlers subscribed via cron.json `on` field. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;

  /** Open the shared SQLite database. */
  getDb(): unknown;

  /** Read bounded runtime facts without opening SQLite directly. */
  query: QueryAPI;

  /** Execute typed state changes through durable events. */
  commands: CommandAPI;

  /** Log a diagnostic message. */
  log(msg: string): void;

  /** Send a human-visible notification (Telegram, web). */
  notify(msg: string): void;

  /** Define, record, evaluate, and inspect system metrics. */
  metrics: MetricService;

  /** Persistent state directory. */
  persistDir: string;
  /** App-scoped absolute paths, present when infrastructure runs an Agent App workflow. */
  appDir?: string;
  projectDir?: string;
  workspaceDir?: string;

  /** Project root directory. */
  projectRoot: string;

  /** Agents root directory. */
  agentsRoot: string;

  /** Shared conventions, guards, docs directory. */
  sharedRoot: string;

  /** First-class projects directory. */
  projectsRoot: string;

  // ── Workflow-specific ──────────────────────────────────────────────

  /** Run a sub-agent, wait for it to finish, return result.
   *  Checks the steering queue before each step — if a steering signal
   *  is pending, throws WorkflowInterrupted.
   *  @throws {WorkflowInterrupted} If a steering signal is received while the agent is running.
   */
  runAgent<S extends TSchema>(
    name: string,
    task: string,
    opts: WorkflowAgentOptions<S> & { schema: S },
  ): Promise<SchemaBackedTaskResult<S>>;
  runAgent(name: string, task: string, opts?: WorkflowAgentOptions): Promise<WorkflowAgentTaskResult>;

  /** Run work in a durable agent session.
   *  If sessionId is provided and already has a terminal result, return that
   *  result instead of repeating work. If the session is active, wait for it.
   *  If it is missing or cannot be resumed, create a fresh session like
   *  runAgent().
   */
  runAgentSession<S extends TSchema>(
    name: string,
    task: string,
    sessionId: string | undefined,
    opts: WorkflowAgentOptions<S> & { schema: S },
  ): Promise<SchemaBackedTaskResult<S>>;
  runAgentSession(
    name: string,
    task: string,
    sessionId?: string,
    opts?: WorkflowAgentOptions,
  ): Promise<WorkflowAgentTaskResult>;

  /** Run a sub-workflow by name. Enables workflow composition. */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;

  /** Run a JS function as a workflow step. No LLM cost.
   *  Returns a TaskResult-like object with the function's output.
   *  Timeout: 30s. Output truncated to 50KB. */
  runFunction(label: string, fn: () => Promise<string>): Promise<TaskResult>;

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
  done(summary: string, output?: unknown): WorkflowResult;

  /** Mark workflow as locally blocked. Does not emit escalation.created. */
  blocked(reason: string, context?: unknown): WorkflowResult;

  /** Create a persistent agent session that stays alive across prompt() calls.
   *  Each prompt() call creates a new agent session with accumulated history,
   *  tracked as a workflow step (guards fire, steps persist). */
  createSession(opts: SessionOptions): Promise<SessionHandle>;
}

/** Options for creating a persistent session. */
export interface SessionOptions {
  /** System prompt for the session. */
  systemPrompt: string;
  /** Tool set: "full" = read+write+bash+edit, "readonly" = read only. */
  tools: "full" | "readonly";
  /** Label for logging (e.g. "worker", "reviewer"). */
  label?: string;
}

/** Handle to a persistent agent session.
 *  Each prompt() call runs a new agent session under the hood,
 *  but accumulates conversation history so the agent has continuity. */
export interface SessionHandle {
  /** Send a prompt. Agent works until idle. Accumulates in session history. */
  prompt(message: string): Promise<void>;
  /** Get the last assistant text from the session. */
  lastText(): string;
  /** End the session. */
  close(): void;
}

// ── Workflow Module ────────────────────────────────────────────────────

/** Shape of a loaded workflow .ts file. */
export interface WorkflowModule {
  name: string;
  description: string;
  /** Optional bounded wall-clock budget for workflows that run long evaluations. */
  executionTimeoutMs?: number;
  /** Filesystem isolation convention interpreted by the embedding app runtime. */
  workspace?: "shared" | "task" | { kind: "task"; baseBranch: string };
  execute: (ctx: WorkflowContext) => Promise<WorkflowResult>;
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
