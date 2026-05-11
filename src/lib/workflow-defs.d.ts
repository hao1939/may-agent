/**
 * Ambient type definitions for workflow .ts files.
 *
 * Workflow files reference this for type checking:
 *   /// <reference path="../../../src/workflow-defs.d.ts" />
 *
 * IMPORTANT: These types must stay in sync with their source of truth:
 *   - TaskResult        → src/types.ts
 *   - WorkflowEvent     → src/workflow.ts
 *   - WorkflowResult    → src/workflow.ts
 *   - WorkflowContext   → src/workflow.ts
 *   - HandoffOptions    → src/handoff.ts
 */

/** Result from running a sub-agent. */
interface TaskResult {
  sessionId: string;
  status: "done" | "error" | "interrupted";
  lastAssistantText: string | null;
  messages: any[];
  duration: string;
  outputDir: string;
  error?: string;
  /** Number of assistant turns completed in this session. */
  turnsUsed?: number;
  /** Structured data from the agent's finish() tool call, if one was made. */
  finishResult?: {
    status: "success" | "failure" | "blocked" | "partial";
    summary: string;
    deliverables?: { path: string; description: string }[];
    blockers?: { reason: string; context: string }[];
    next_steps?: string;
  };
}

/** Workflow event types for observability. */
type WorkflowEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_start"; step: string; sessionId?: string }
  | { type: "step_done"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow_done"; summary: string }
  | { type: "workflow_escalate"; reason: string };

/** Workflow result — either done or escalated to slow mode. */
type WorkflowResult = { type: "done"; summary: string } | { type: "escalate"; reason: string; context?: unknown };

/** Options for customizing the handoff summary. */
interface HandoffOptions {
  /** Include the agent's final response text. Default: true. */
  includeResponse?: boolean;
  /** Include key facts (files read/written, exec commands). Default: true. */
  includeKeyFacts?: boolean;
  /** Include error summaries. Default: true. */
  includeErrors?: boolean;
  /** Include file content previews for written files. Default: false. */
  includeWriteContents?: boolean;
  /** Maximum total length of the handoff summary. Default: 8000. */
  maxLength?: number;
}

interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
  limit: number;
  truncated: boolean;
}

interface QueryAPI {
  sessions(filter?: Record<string, unknown>): QueryResult;
  events(filter?: Record<string, unknown>): QueryResult;
  metrics(filter?: Record<string, unknown>): QueryResult;
  alerts(filter?: Record<string, unknown>): QueryResult;
  projects(filter?: Record<string, unknown>): QueryResult;
  metricAlertContext(filter: Record<string, unknown>): Record<string, unknown>;
  sql(sql: string, params?: unknown[], opts?: { limit?: number }): QueryResult;
}

/** Context provided to workflow execute() functions. */
interface WorkflowContext {
  /** The original task. */
  task: string;

  /** The name of the agent that called this workflow.
   *  Use this instead of hardcoding agent names in shared workflows. */
  agent: string;

  // ── RuntimeCtx (shared infra) ──────────────────────────────────────

  /** Emit an event on the bus. All events — workflow, domain, system — go through one bus. */
  emit(event: { type: string; [key: string]: unknown }): void;

  /** Dispatch an agent-level event to handlers subscribed via cron.json `on` field. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;

  /** Open the shared SQLite database. */
  getDb(): unknown;

  /** Read bounded runtime facts without opening SQLite directly. */
  query: QueryAPI;

  /** Log a diagnostic message. */
  log(msg: string): void;

  /** Send a human-visible notification (Telegram, web). */
  notify(msg: string): void;

  /** Persistent state directory. */
  persistDir: string;

  /** Project root directory. */
  projectRoot: string;

  /** Agents root directory. */
  agentsRoot: string;

  // ── Workflow-specific ──────────────────────────────────────────────

  /** Run a sub-agent, wait for it to finish, return result. */
  runAgent(name: string, task: string): Promise<TaskResult>;

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
  done(summary: string): WorkflowResult;

  /** Escalate — workflow can't handle this, return to agent (slow mode). */
  escalate(reason: string, context?: unknown): WorkflowResult;

  /** Create a persistent agent session that stays alive across prompt() calls. */
  createSession(opts: SessionOptions): Promise<SessionHandle>;
}

/** Options for creating a persistent session. */
interface SessionOptions {
  /** System prompt for the session. */
  systemPrompt: string;
  /** Tool set: "full" = read+write+bash+edit, "readonly" = read only. */
  tools: "full" | "readonly";
  /** Label for logging (e.g. "worker", "reviewer"). */
  label?: string;
}

/** Handle to a persistent agent session. */
interface SessionHandle {
  /** Send a prompt. Agent works until idle. Accumulates in session history. */
  prompt(message: string): Promise<void>;
  /** Get the last assistant text from the session. */
  lastText(): string;
  /** End the session. */
  close(): void;
}

// ── Guard Types ──────────────────────────────────────────────────────────

/** Completed step info passed to guards. */
interface CompletedStep {
  step: string;
  sessionId: string;
  result: TaskResult;
}

/** Demand: what a guard wants the workflow engine to do. */
interface Demand {
  type: "block" | "warn" | "run_step";
  reason: string;
  /** Name of the guard that issued this demand (set by engine). */
  guardName?: string;
  /** For run_step: details of the step to inject. */
  step?: {
    agent: string;
    task: string;
    label?: string;
  };
}

/** Events that guards can subscribe to. */
type WorkflowGuardEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_done"; source: "agent" | "function"; step: string; sessionId?: string; result: TaskResult; completedSteps: CompletedStep[]; task: string }
  | { type: "workflow_done"; workflow: string; summary: string; completedSteps: CompletedStep[] };

/** A guard module that inspects workflow events and returns demands. */
interface WorkflowGuard {
  /** Guard name for logging. */
  name: string;
  /** Optional: only receive specific event types. */
  events?: WorkflowGuardEvent["type"][];
  /** Inspect an event and return zero or more demands. */
  handle(event: WorkflowGuardEvent): Demand[];
}

/** Guard module shape — export `guard` from a guard .ts file. */
interface GuardModule {
  guard: WorkflowGuard;
}
