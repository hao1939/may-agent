/**
 * RuntimeCtx — concrete implementation of the shared infrastructure surface.
 *
 * Build once in the binary, pass to handlers, workflows, and agent tools.
 * See: agents/shared/may-agent-docs/design/runtime-ctx.md
 */

import type { RuntimeCtx } from "./handler-context.js";
import type { EventBus } from "../app/event-bus.js";
import { getDb } from "./requests.js";
import { log as globalLog } from "./log.js";
import { saveWorkflowRun as _saveWorkflowRun, readSessionMeta as _readSessionMeta } from "./persistence.js";
import { summarizeForHandoff as _summarizeForHandoff } from "./handoff.js";
import { classifyError as _classifyError } from "./classify-error.js";
import { getLastDigest as _getLastDigest, upsertDigest as _upsertDigest, classifyDigest as _classifyDigest } from "./session-digest.js";
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
    dispatchEvent: (eventType, data) => opts.bus.emit({ type: "emit", event: eventType, data } as any),
    getDb: () => getDb(opts.persistDir),
    log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    notify: (msg) => opts.bus.emit({ type: "notification", agent: opts.agentName, text: msg }),
    saveWorkflowRun: (run) => _saveWorkflowRun(opts.persistDir, run as any),
    summarizeForHandoff: (result, handoffOpts?) => _summarizeForHandoff(result as any, handoffOpts as any),
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
      // Push to Telegram via notification event
      opts.bus.emit({ type: "notification", agent: opts.agentName, text: `⚠️ *Agent Blocked*\n${agent} — ${reason}` });
    },
    readSessionMeta: (sessionId) => _readSessionMeta(opts.persistDir, sessionId),
  };
}
