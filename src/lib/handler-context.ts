/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Each handler's create(ctx, entry) factory receives this context,
 * which provides everything the handler needs from the runtime.
 *
 * Runtime APIs (getDb, trackRequest, etc.) are provided here so that
 * handlers don't need to import from src/lib/ directly. This allows
 * handlers to work in binary-only deployments where source files are
 * not present on disk.
 */

import type { SubagentManager } from "./index.js";
import type { CronEntry } from "./cron-tool.js";
import type { SqliteDb } from "./db.js";
import type { PersistedSession } from "./persistence.js";
import type { TaskEvaluationResult } from "./evaluator.js";

export interface TrackRequestOpts {
  fromEntity: string;
  toAgent: string;
  task: string;
  method: "chat" | "call" | "message" | "notify" | "workflow";
  sessionId?: string;
  parentRequestId?: string;
  source?: string;
  artifact?: string;
  context?: string;
  expectations?: string;
  notify?: string[];
}

interface EvaluateTaskOpts {
  manager: SubagentManager;
  persistDir: string;
  parentSessionId: string;
  skipAgents?: Set<string>;
}

/**
 * RuntimeCtx — the shared infrastructure surface available to handlers, workflows, and agent tools.
 *
 * See: agents/shared/may-agent-docs/design/runtime-ctx.md
 */
export interface RuntimeCtx {
  /** Emit an event on the bus. All events go through one bus. */
  emit(event: { type: string; [key: string]: unknown }): void;
  /** Open the shared SQLite database. */
  getDb(): SqliteDb;
  /** Log a diagnostic message. */
  log(msg: string): void;
  /** Send a human-visible notification (Telegram, web). */
  notify(msg: string): void;
  /** Save a workflow run record to .state/workflows/. */
  saveWorkflowRun(run: Record<string, unknown>): void;
  /** Summarize a task result for handoff. */
  summarizeForHandoff(result: Record<string, unknown>, opts?: Record<string, unknown>): string;
  /** Persistent state directory. */
  persistDir: string;
  /** Project root directory. */
  projectRoot: string;
  /** Agents root directory. */
  agentsRoot: string;
}

export interface HandlerContext extends RuntimeCtx {
  /** SubagentManager — for run(), followUp(), etc. */
  manager: SubagentManager;

  /** Name of the agent that owns this handler (e.g., "may") */
  agentName: string;

  /** Agent's persistent session ID getter (for followUp). Returns null if no active session. */
  getSessionId: () => string | null;

  /** Trigger a cron entry immediately (reactive trigger). Returns true if fired/latched. */
  triggerNow: (entryName: string) => boolean;

  /** Track a request in the requests table. Returns the request ID.
   * @deprecated Use ctx.emit({ type: "message_created", ... }) instead. */
  trackRequest: (opts: TrackRequestOpts) => string;

  /** Load all session metadata (active + archived). */
  loadAllSessionMetas: () => Record<string, PersistedSession>;

  /** Evaluate a completed task tree. Returns null if nothing to evaluate. */
  evaluateTask: (opts: EvaluateTaskOpts) => Promise<TaskEvaluationResult | null>;
}

/**
 * The shape a handler module must export.
 *
 * The `create` factory is called once at startup. It receives the
 * HandlerContext (stable across fires) and the cron entry (for handlerConfig).
 * Returns the async function that runs on each cron fire.
 */
export interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => () => Promise<void>;
}
