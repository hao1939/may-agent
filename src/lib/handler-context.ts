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
  method: "chat" | "call" | "message" | "workflow";
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

export interface HandlerContext {
  /** SubagentManager — for run(), followUp(), etc. */
  manager: SubagentManager;

  /** Persistent state directory (e.g., .state/) */
  persistDir: string;

  /** Project root (e.g., /home/example-user/may-agent) */
  projectRoot: string;

  /** Agents directory (e.g., /home/example-user/may-agent/agents) */
  agentsRoot: string;

  /** Name of the agent that owns this handler (e.g., "may") */
  agentName: string;

  /** Agent's persistent session ID getter (for followUp). Returns null if no active session. */
  getSessionId: () => string | null;

  /** Log a diagnostic message (routed through EventBus as info). */
  log: (msg: string) => void;

  /** Send a message to the human (routed through EventBus on the chat channel, visible in Telegram). */
  notify: (msg: string) => void;

  /** Trigger a cron entry immediately (reactive trigger). Returns true if fired/latched. */
  triggerNow: (entryName: string) => boolean;

  // ── Runtime APIs ──────────────────────────────────────────────────
  // These are provided by the binary so handlers don't need to import
  // from src/lib/ (which may not exist on disk in compiled deployments).

  /** Open (or return cached) SQLite database for the persist directory. */
  getDb: () => SqliteDb;

  /** Track a request in the requests table. Returns the request ID.
   * @deprecated Use ctx.emit({ type: "message_created", ... }) instead. */
  trackRequest: (opts: TrackRequestOpts) => string;

  /** Emit an event on the EventBus. Handlers use this to send findings to agents
   * instead of writing to files. The event flows through subscribers (DbWriter, etc). */
  emit: (event: { type: string; [key: string]: unknown }) => void;

  /** Load all session metadata (active + archived). */
  loadAllSessionMetas: () => Record<string, PersistedSession>;

  /** Evaluate a completed task tree. Returns null if nothing to evaluate. */
  evaluateTask: (opts: EvaluateTaskOpts) => Promise<TaskEvaluationResult | null>;

  /** Write skipped evaluations (meta-agents, no transcript). Returns count written. */
  writeSkippedEvaluations: (skipAgents?: Set<string>) => Promise<number>;

  /** Write heuristic evaluations (deterministic scoring). Returns count written. */
  writeHeuristicEvaluations: () => Promise<number>;
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
