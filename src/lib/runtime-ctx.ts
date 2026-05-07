/**
 * RuntimeCtx — concrete implementation of the shared infrastructure surface.
 *
 * Build once in the binary, pass to handlers, workflows, and agent tools.
 * See: agents/shared/may-agent-docs/runtime.md
 */

import type { RuntimeCtx } from "./handler-context.js";
import type { EventBus } from "../app/event-bus.js";
import { getDb, upsertEvaluation as _upsertEvaluation, hasEvaluation as _hasEvaluation, hasLLMEvaluation as _hasLLMEvaluation, getAllEvaluations as _getAllEvaluations } from "./requests.js";
import { log as globalLog } from "./log.js";
import { readSessionMeta as _readSessionMeta, readSessionMessages as _readSessionMessages, readArchivedSessionMessages as _readArchivedSessionMessages } from "./persistence.js";
import { classifyError as _classifyError } from "./classify-error.js";
import { getLastDigest as _getLastDigest, upsertDigest as _upsertDigest, classifyDigest as _classifyDigest } from "./session-digest.js";
import { syncAll as _syncAll } from "./research-db.js";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RuntimeCtxOptions {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  /** Agent name for log/notification attribution. */
  agentName: string;
}

export function buildRuntimeCtx(opts: RuntimeCtxOptions): RuntimeCtx {
  return {
    emit: (event) => opts.bus.emit(event as any),
    dispatchEvent: (eventType, data) => opts.bus.emit({ type: eventType, ...(data || {}) } as any),
    getDb: () => getDb(opts.persistDir),
    log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    notify: (msg) => {
      opts.bus.emit({ type: "message.created", from: opts.agentName, to: "human", content: msg } as any);
      opts.bus.emit({ type: "notification", agent: opts.agentName, text: msg } as any);
    },
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
    classifyError: (error) => _classifyError(error),
    getLastDigest: (sessionId) => _getLastDigest(opts.persistDir, sessionId),
    upsertDigest: (input) => _upsertDigest(opts.persistDir, input),
    classifyDigest: (digest, trigger) => _classifyDigest(digest, trigger),
    escalate: (agent, reason) => {
      // Persist to escalations.jsonl (survives restarts, Telegram outages)
      try {
        const escalationPath = resolve(opts.persistDir, "escalations.jsonl");
        const entry = JSON.stringify({ ts: new Date().toISOString(), agent, reason, notified: true });
        appendFileSync(escalationPath, entry + "\n", "utf-8");
      } catch { /* best-effort */ }
      // Push to Telegram via message.created to human
      opts.bus.emit({ type: "message.created", from: opts.agentName, to: "human", content: `⚠️ *Agent Blocked*\n${agent} — ${reason}` } as any);
    },
    readSessionMeta: (sessionId) => _readSessionMeta(opts.persistDir, sessionId),

    // ── Event inbox (time-window based, immutable events) ────────────
    getInbox: (inboxOpts) => {
      const db = getDb(opts.persistDir);
      const agent = inboxOpts?.agent ?? opts.agentName;
      const limit = inboxOpts?.limit ?? 20;
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      return db.prepare(`
        SELECT id, event_type, data, urgency, timestamp
        FROM events
        WHERE owner = ?
          AND timestamp > ?
          AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
        ORDER BY
          CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
          timestamp DESC
        LIMIT ?
      `).all(agent, twoHoursAgo, Date.now(), limit) as any[];
    },

    // ── Session messages ────────────────────────────────────────────
    readSessionMessages: (sessionId) => _readSessionMessages(opts.persistDir, sessionId),
    readArchivedSessionMessages: (sessionId) => _readArchivedSessionMessages(opts.persistDir, sessionId),

    // ── Evaluation persistence ──────────────────────────────────────
    upsertEvaluation: (evalOpts) => _upsertEvaluation(opts.persistDir, evalOpts as any),
    hasEvaluation: (sessionId) => _hasEvaluation(opts.persistDir, sessionId),
    hasLLMEvaluation: (sessionId) => _hasLLMEvaluation(opts.persistDir, sessionId),
    getAllEvaluations: () => _getAllEvaluations(opts.persistDir) as any[],

    // ── Research sync ───────────────────────────────────────────────
    syncResearchArtifacts: (basePath) => _syncAll(getDb(opts.persistDir), basePath ?? `${opts.agentsRoot}/shared/knowledge`),
  };
}
