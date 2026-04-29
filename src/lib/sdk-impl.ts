/**
 * sdk-impl.ts — Concrete AgentSDK implementation wrapping existing internals.
 *
 * This is the bridge: handlers/workflows get an AgentSDK object,
 * which delegates to manager, bus, DB under the hood.
 *
 * Design: agents/shared/may-agent-docs/sdk.md
 */

import type { AgentSDK, WorkflowSDK, RunOpts, TaskResult, SessionOpts, SessionHandle, DoneOpts, WorkflowResult } from "./sdk.js";
import type { EventBus } from "../app/event-bus.js";
import type { SqliteDb } from "./db.js";
import { getDb } from "./requests.js";
import { log as globalLog } from "./log.js";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Dependencies (injected, not imported directly) ────────────────────

export interface SDKDeps {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  agentName: string;
  /** Manager's callAgent — async, blocks until agent finishes. */
  callAgent: (agent: string, task: string, opts?: { source?: string; projectId?: string; timeout?: number }) => Promise<TaskResult>;
  /** Cron triggerNow — fire a handler on next tick. */
  triggerNow?: (handlerName: string) => boolean;
}

// ── Build AgentSDK ────────────────────────────────────────────────────

export function buildAgentSDK(deps: SDKDeps): AgentSDK {
  return {
    runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult> {
      return deps.callAgent(agent, task, {
        source: opts?.source,
        projectId: opts?.projectId,
        timeout: opts?.timeout,
      });
    },

    createLLMSession(_opts: SessionOpts): Promise<SessionHandle> {
      // TODO: Wire to pi-agent's createSession when needed
      throw new Error("createLLMSession not yet implemented");
    },

    emit(type: string, data?: Record<string, unknown>): void {
      deps.bus.emit({ type, ...(data || {}) } as any);
    },

    getDb(): SqliteDb {
      return getDb(deps.persistDir);
    },

    log(level: "info" | "warn" | "error", msg: string): void {
      globalLog(level, `[${deps.agentName}] ${msg}`);
    },

    notify(target: string, msg: string): void {
      if (target === "human") {
        // Human-visible: push to Telegram/web via notification event
        deps.bus.emit({ type: "notification", agent: deps.agentName, text: msg } as any);
      } else {
        // Agent-to-agent: emit as agent.notification event (appears in target's inbox)
        deps.bus.emit({
          type: "agent.notification",
          owner: target,
          source: deps.agentName,
          data: { task: msg },
        } as any);
      }
    },

    escalate(target: string, reason: string): void {
      // Persist to escalations.jsonl (survives restarts)
      try {
        const escalationPath = resolve(deps.persistDir, "escalations.jsonl");
        const entry = JSON.stringify({ ts: new Date().toISOString(), agent: deps.agentName, target, reason });
        appendFileSync(escalationPath, entry + "\n", "utf-8");
      } catch { /* best-effort */ }

      // Emit escalation event
      deps.bus.emit({
        type: "escalation.created",
        owner: target,
        source: deps.agentName,
        reason,
      } as any);

      // Also push human-visible notification
      deps.bus.emit({
        type: "notification",
        agent: deps.agentName,
        text: `\u26a0\ufe0f *Escalation*\n${deps.agentName} \u2192 ${target}: ${reason}`,
      } as any);
    },

    paths: {
      persist: deps.persistDir,
      root: deps.projectRoot,
      agents: deps.agentsRoot,
    },
  };
}

// ── Build WorkflowSDK ─────────────────────────────────────────────────

export interface WorkflowSDKDeps extends SDKDeps {
  task: string;
  /** Callback to terminate the workflow. */
  finish: (result: WorkflowResult) => void;
}

export function buildWorkflowSDK(deps: WorkflowSDKDeps): WorkflowSDK {
  const base = buildAgentSDK(deps);

  return {
    ...base,
    task: deps.task,
    agent: deps.agentName,

    done(summary: string, opts?: DoneOpts): WorkflowResult {
      const result: WorkflowResult = { status: "done", summary };
      deps.finish(result);
      return result;
    },

    // escalate inherited from base, but in workflow context also terminates
    escalate(target: string, reason: string): void {
      base.escalate(target, reason);
      deps.finish({ status: "escalated", summary: reason });
    },
  };
}
