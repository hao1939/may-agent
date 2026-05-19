/**
 * RuntimeCtx — internal infrastructure surface used by workflow-tool and sdk-impl.
 *
 * NOT exported to handlers — they use HandlerContext (which has sdk + helpers).
 * This is the internal plumbing that WorkflowContext spreads from.
 */

import type { EventBus } from "../app/event-bus.js";
import type { SqliteDb } from "./db.js";
import { getDb } from "./requests.js";
import { log as globalLog } from "./log.js";
import { createMetricService, type MetricService } from "./metrics.js";
import { createQueryService, type QueryAPI } from "./query-service.js";
import { readSessionMeta as _readSessionMeta, readSessionMessages as _readSessionMessages } from "./persistence.js";
import { classifyError as _classifyError } from "./classify-error.js";
import { getLastDigest as _getLastDigest, upsertDigest as _upsertDigest, classifyDigest as _classifyDigest } from "./session-digest.js";
import type { PersistedSession } from "./persistence.js";
import type { DigestRow, DigestInput, DigestAction } from "./session-digest.js";
import type { ErrorClass } from "./classify-error.js";

/**
 * RuntimeCtx — internal type for workflow/sdk infra.
 * Provides emit, getDb, log, notify, paths for WorkflowContext construction.
 */
export interface RuntimeCtx {
  emit(event: { type: string; [key: string]: unknown }): void;
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;
  getDb(): SqliteDb;
  query: QueryAPI;
  log(msg: string): void;
  notify(msg: string): void;
  metrics: MetricService;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
}

export interface RuntimeCtxOptions {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  agentName: string;
}

export function buildRuntimeCtx(opts: RuntimeCtxOptions): RuntimeCtx {
  return {
    emit: (event) => opts.bus.emit(event as any),
    dispatchEvent: (eventType, data) => opts.bus.emit({ type: eventType, ...(data || {}) } as any),
    getDb: () => getDb(opts.persistDir),
    query: createQueryService({
      getDb: () => getDb(opts.persistDir),
    }),
    log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    notify: (msg) => {
      opts.bus.emit({ type: "message.created", from: opts.agentName, to: "human", content: msg } as any);
      opts.bus.emit({ type: "notification", agent: opts.agentName, text: msg } as any);
    },
    metrics: createMetricService({
      getDb: () => getDb(opts.persistDir),
      emit: (type, data, envelope) => opts.bus.emit({
        type,
        source: envelope?.source ?? opts.agentName,
        owner: envelope?.owner ?? opts.agentName,
        ...(envelope?.urgency ? { urgency: envelope.urgency } : {}),
        ...(typeof envelope?.ttl_ms === "number" ? { ttl_ms: envelope.ttl_ms } : {}),
        data: data ?? {},
      } as any),
      measuredBy: opts.agentName,
      log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    }),
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
  };
}

/**
 * Build session lifecycle helpers for HandlerContext.
 */
export function buildSessionHelpers(opts: RuntimeCtxOptions) {
  return {
    classifyError: (error: string | undefined | null): ErrorClass => _classifyError(error),
    getLastDigest: (sessionId: string): DigestRow | null => _getLastDigest(opts.persistDir, sessionId),
    upsertDigest: (input: DigestInput): Promise<DigestRow | null> => _upsertDigest(opts.persistDir, input),
    classifyDigest: (digest: { outcome: string; still_open: string | null; what_happened: string }, trigger: string): { action: DigestAction; reason: string } => _classifyDigest(digest, trigger),
    readSessionMeta: (sessionId: string): PersistedSession | null => _readSessionMeta(opts.persistDir, sessionId),
    readSessionMessages: (sessionId: string): unknown[] => _readSessionMessages(opts.persistDir, sessionId),
  };
}
