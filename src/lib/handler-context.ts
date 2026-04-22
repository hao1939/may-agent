/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Each handler's create(ctx, entry) factory receives this context,
 * which provides everything the handler needs from the runtime.
 *
 * Runtime APIs are provided here so that handlers don't need to import
 * from src/lib/ directly. Agents import types via agents/shared/agent-sdk.ts.
 */

import type { SubagentManager } from "./index.js";
import type { CronEntry } from "./cron-tool.js";
import type { SqliteDb } from "./db.js";
import type { PersistedSession } from "./persistence.js";
import type { DigestRow, DigestInput, DigestAction } from "./session-digest.js";
import type { ErrorClass } from "./classify-error.js";

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

/**
 * RuntimeCtx — the shared infrastructure surface available to handlers, workflows, and agent tools.
 *
 * See: agents/shared/may-agent-docs/design/runtime-ctx.md
 */
export interface RuntimeCtx {
  /** Emit an event on the bus. All events go through one bus. */
  emit(event: { type: string; [key: string]: unknown }): void;
  /** Dispatch an agent-level event to handlers subscribed via cron.json `on` field. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;
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

  // ── Session digest & error classification ─────────────────────────
  /** Classify an error string into a category (infra/logic/abort/overflow). */
  classifyError(error: string | undefined | null): ErrorClass;
  /** Get the latest digest row for a session. */
  getLastDigest(sessionId: string): DigestRow | null;
  /** Upsert a digest record (create or update). */
  upsertDigest(input: DigestInput): Promise<DigestRow | null>;
  /** Classify a digest to determine action (resume/requeue/escalate/kill/nothing). */
  classifyDigest(digest: { outcome: string; still_open: string | null; what_happened: string }, trigger: string): { action: DigestAction; reason: string };
  /** Persist an escalation event and push to Telegram. */
  escalate(agent: string, reason: string): void;
  /** Read session metadata by sessionId. */
  readSessionMeta(sessionId: string): PersistedSession | null;

  // ── Event inbox (convention-defaults) ─────────────────────────────
  /** Mark an inbox event status. */
  updateEvent(eventId: number, status: "acked" | "done" | "dismissed" | "failed", opts?: {
    handledBy?: string; result?: string; reason?: string;
  }): void;
  /** Query pending inbox events for an agent. */
  getInbox(opts?: { agent?: string; limit?: number }): Array<{
    id: number; event_type: string; data: string;
    urgency: string; timestamp: number; retry_count: number;
  }>;

  // ── Session messages (for evaluation / context-learn) ────────────
  /** Read messages from an active session. */
  readSessionMessages(sessionId: string): unknown[];
  /** Read messages from an archived session. */
  readArchivedSessionMessages(sessionId: string): unknown[];

  // ── Evaluation persistence ───────────────────────────────────────
  /** Insert or replace an evaluation record. */
  upsertEvaluation(opts: {
    sessionId: string; agent: string; quality: number; efficiency: number;
    productiveCalls?: number; wastedCalls?: number; verdict: string;
    issues?: string[]; overall?: Record<string, unknown>; usage?: Record<string, unknown>;
    failureChains?: unknown[]; evaluatedByHeuristic?: boolean; skippedByJs?: boolean;
    createdAt: number;
  }): void;
  /** Check if a session has any evaluation (heuristic or LLM). */
  hasEvaluation(sessionId: string): boolean;
  /** Check if a session has an LLM evaluation. */
  hasLLMEvaluation(sessionId: string): boolean;
  /** Get all evaluation records. */
  getAllEvaluations(): Array<Record<string, unknown>>;

  // ── Research sync ────────────────────────────────────────────────
  /** Sync markdown research artifacts into SQLite. */
  syncResearchArtifacts(basePath?: string): {
    knowledgeEntries: { synced: number; errors: string[] };
    hypotheses: { synced: number; errors: string[] };
    experiments: { synced: number; errors: string[] };
  };
}

/**
 * TriggerEvent — passed to handlers on every invocation.
 * Timer ticks, bus events, and manual triggers are all events.
 */
export interface TriggerEvent {
  type: string;                           // "timer.tick" | "metric.breach" | etc.
  source: "timer" | "event" | "manual";   // how it was triggered
  entry: string;                          // cron entry name
  data?: Record<string, unknown>;         // event payload (for bus events)
  timestamp: number;
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
}

/**
 * The shape a handler module must export.
 *
 * The `create` factory is called once at startup. It receives the
 * HandlerContext (stable across fires) and the cron entry (for handlerConfig).
 * Returns the async function that runs on each cron fire.
 */
export interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => (event?: TriggerEvent) => Promise<void>;
}
