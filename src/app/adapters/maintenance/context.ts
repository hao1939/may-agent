/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Handlers access the system through ctx.sdk (HandlerSDK) for all standard
 * operations. A few handler-specific helpers remain on ctx directly.
 */

import type { MaintenanceEntry } from "./contracts.js";
import type { PersistedSession } from "../../../lib/persistence.js";
import type { DigestRow, DigestInput, DigestAction } from "../../../lib/session-digest.js";
import type { ErrorClass } from "../../../lib/classify-error.js";
import type { AgentSDK } from "../../../lib/sdk.js";
import type { EventEnvelope } from "../../event-bus.js";

/** Host maintenance files can observe/repair mechanics, but cannot launch App work. */
export type HandlerSDK = Pick<AgentSDK, "emit" | "getDb" | "query" | "metrics" | "log" | "message" | "paths">;

/**
 * HandlerContext — flat interface for handler code.
 *
 * Use ctx.sdk for mechanical operations (emit, getDb, log, paths).
 * Handler-specific session lifecycle helpers remain on ctx directly.
 */
export interface HandlerContext {
  sdk: HandlerSDK;

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
  create: (
    ctx: HandlerContext,
    entry: MaintenanceEntry,
  ) => (event?: EventEnvelope, signal?: AbortSignal) => Promise<void>;
}
