/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Handlers access the system through ctx.sdk (AgentSDK) for all standard
 * operations. A few handler-specific helpers remain on ctx directly.
 */

import type { CronEntry } from "./cron-tool.js";
import type { PersistedSession } from "./persistence.js";
import type { DigestRow, DigestInput, DigestAction } from "./session-digest.js";
import type { ErrorClass } from "./classify-error.js";
import type { AgentSDK } from "./sdk.js";

/** Canonical event envelope delivered to handlers. */
export interface EventEnvelope {
  type: string;
  source: string;
  owner: string;
  timestamp?: number;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  visibility?: "default" | "detail";
  trace?: {
    traceId: string;
    parentEventId?: number;
    links?: Array<{ eventId: number; type?: "reference" | "closure"; label?: string }>;
  };
  target?: {
    project?: string;
    taskId?: string;
    owner?: string;
    sessionId?: string;
    human?: boolean;
  };
  data: Record<string, unknown>;
}

/**
 * HandlerContext — flat interface for handler code.
 *
 * Use ctx.sdk for all standard operations (runAgent, emit, getDb, log, paths).
 * Handler-specific session lifecycle helpers remain on ctx directly.
 */
export interface HandlerContext {
  /** Agent SDK — the canonical capability surface. */
  sdk: AgentSDK;

  /** Name of the agent that owns this handler (e.g., "may") */
  agentName: string;

  /** Trigger an entry immediately (reactive trigger). Returns true if fired/latched. */
  triggerNow: (entryName: string) => boolean;

  // ── Session lifecycle (used by session-recovery, escalation) ──────
  /** Classify an error string into a category (infra/logic/abort/overflow). */
  classifyError(error: string | undefined | null): ErrorClass;
  /** Get the latest digest row for a session. */
  getLastDigest(sessionId: string): DigestRow | null;
  /** Upsert a digest record (create or update). */
  upsertDigest(input: DigestInput): Promise<DigestRow | null>;
  /** Classify a digest to determine action (resume/requeue/escalate/kill/nothing). */
  classifyDigest(
    digest: { outcome: string; still_open: string | null; what_happened: string },
    trigger: string,
  ): { action: DigestAction; reason: string };

  // ── Session data (used by session-eval) ───────────────────────────
  /** Read session metadata by sessionId. */
  readSessionMeta(sessionId: string): PersistedSession | null;
  /** Read messages from a session. */
  readSessionMessages(sessionId: string): unknown[];
}

/**
 * The shape a handler module must export.
 */
export interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => (event?: EventEnvelope) => Promise<void>;
}
