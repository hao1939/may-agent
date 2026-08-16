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
  /** Provider/runtime error surfaced on the terminal assistant message, when present. */
  errorMessage?: string;
  /** Number of assistant turns completed in this session. */
  turnsUsed?: number;
  /** Structured data from the agent's finish() tool call, if one was made. */
  finishResult?: {
    status: "success" | "failure" | "blocked" | "partial";
    summary: string;
    deliverables?: { path: string; description: string }[];
    blockers?: { reason: string; context: string }[];
    next_steps?: string;
    result?: unknown;
  };
  /** Caller-defined, schema-validated payload from finish().result. */
  structuredResult?: unknown;
}

type WorkflowAgentOptions<S extends import("@earendil-works/pi-ai").TSchema = import("@earendil-works/pi-ai").TSchema> =
  {
    timeoutMs?: number;
    tools?: "full" | "readonly";
    skill?: string;
    schema?: S;
  };

type WorkflowAgentTaskResult =
  | (TaskResult & { status: "done"; finishResult: NonNullable<TaskResult["finishResult"]> })
  | (TaskResult & { status: "error" | "interrupted" });

type SchemaBackedTaskResult<S extends import("@earendil-works/pi-ai").TSchema> =
  | (WorkflowAgentTaskResult & {
      status: "done";
      structuredResult: import("@earendil-works/pi-ai").Static<S>;
    })
  | (TaskResult & {
      status: "error" | "interrupted";
      structuredResult?: import("@earendil-works/pi-ai").Static<S>;
    });

/** Local workflow lifecycle callback events for observability. These are not SystemEvent bus envelopes. */
type WorkflowEvent =
  | { type: "workflow.started"; workflow: string; task: string }
  | { type: "workflow.step_started"; step: string; sessionId?: string }
  | { type: "workflow.step_completed"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow.completed"; summary: string }
  | { type: "workflow.blocked"; reason: string }
  | { type: "workflow.interrupted"; reason?: string };

/** Workflow result — either done or locally blocked. */
type WorkflowResult =
  { type: "done"; summary: string; output?: unknown } | { type: "blocked"; reason: string; context?: unknown };

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
  workflowRuns(filter?: Record<string, unknown>): QueryResult;
  metricAlertContext(filter: Record<string, unknown>): Record<string, unknown>;
  metricAlertReactorState(filter: Record<string, unknown>): Record<string, unknown>;
  eventDeliveryHealth(filter?: Record<string, unknown>): Record<string, unknown>;
  evaluatorDeepEvalScan(filter?: Record<string, unknown>): Record<string, unknown>;
  evaluatorAftermathContext(filter: Record<string, unknown>): Record<string, unknown>;
  sql(sql: string, params?: unknown[], opts?: { limit?: number }): QueryResult;
}

type CommandAPI = Record<never, never>;

/** Context provided to workflow execute() functions. */
interface WorkflowContext {
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

  /** Persistent state directory. */
  persistDir: string;

  /** Project root directory. */
  projectRoot: string;

  /** Agents root directory. */
  agentsRoot: string;

  /** Shared conventions, guards, docs directory. */
  sharedRoot: string;

  /** First-class projects directory. */
  projectsRoot: string;

  // ── Workflow-specific ──────────────────────────────────────────────

  /** Run a sub-agent, wait for it to finish, return result. */
  runAgent<S extends import("@earendil-works/pi-ai").TSchema>(
    name: string,
    task: string,
    opts: WorkflowAgentOptions<S> & { schema: S },
  ): Promise<SchemaBackedTaskResult<S>>;
  runAgent(name: string, task: string, opts?: WorkflowAgentOptions): Promise<WorkflowAgentTaskResult>;

  /** Run work in a durable agent session. */
  runAgentSession<S extends import("@earendil-works/pi-ai").TSchema>(
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

type CompletedStep = import("@may-agent/sdk").WorkflowGuardCompletedStep<TaskResult>;
type Demand = import("@may-agent/sdk").Demand;
type WorkflowGuardEvent = import("@may-agent/sdk").WorkflowGuardEvent<TaskResult>;
type WorkflowGuard = import("@may-agent/sdk").WorkflowGuard<TaskResult>;
type GuardModule = import("@may-agent/sdk").GuardModule<TaskResult>;
