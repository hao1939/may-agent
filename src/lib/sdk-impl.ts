/**
 * sdk-impl.ts — Concrete AgentSDK implementation wrapping existing internals.
 *
 * This is the bridge: handlers/workflows get an AgentSDK object,
 * which delegates to manager, bus, DB under the hood.
 *
 * Design: shared/may-agent-docs/sdk.md
 */

import type { AgentSDK, WorkflowSDK, RunOpts, TaskResult, DoneOpts, WorkflowResult, EscalationOptions } from "./sdk.js";
import type { EventBus } from "../app/event-bus.js";
import type { SqliteDb } from "./db.js";
import type { SubagentManager } from "./manager.js";
import { getDb } from "./requests.js";
import { log as globalLog } from "./log.js";
import { buildRuntimeCtx } from "./runtime-ctx.js";
import { createMetricService } from "./metrics.js";
import { createQueryService } from "./query-service.js";
import { appendFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// ── Dependencies (injected, not imported directly) ────────────────────

export interface SDKDeps {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  agentName: string;
  /** Manager instance — for runWorkflow delegation. */
  manager?: SubagentManager;
  /** Manager's callAgent — async, blocks until agent finishes. */
  callAgent: (agent: string, task: string, opts?: { source?: string; projectId?: string; timeout?: number }) => Promise<TaskResult>;
  /** Cron triggerNow — fire a handler on next tick. */
  triggerNow?: (handlerName: string) => boolean;
}

// ── Workflow path helpers ──────────────────────────────────────────────

export function projectWorkflowDirFor(projectsRoot: string, projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;

  const clean = projectId
    .trim()
    .replace(/^projects\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
  if (!clean) return undefined;

  const candidates = [join(projectsRoot, clean, "workflows")];
  const shortName = basename(clean);
  if (shortName && shortName !== clean) candidates.push(join(projectsRoot, shortName, "workflows"));

  return candidates.find((dir) => existsSync(dir)) ?? candidates[candidates.length - 1];
}

function normalizeOwner(owner: string | undefined): string {
  const value = owner?.trim();
  if (!value) return "agent:may";
  if (value.startsWith("agent:") || value.startsWith("human:")) return value;
  if (value === "human") return "human:operator";
  return `agent:${value}`;
}

function messageOwner(target: string): string {
  return normalizeOwner(target);
}

function urgencyForSeverity(severity: EscalationOptions["severity"]): "low" | "normal" | "high" | "immediate" {
  if (severity === "P0") return "immediate";
  if (severity === "P1") return "high";
  if (severity === "P3") return "low";
  return "normal";
}

function createEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    async runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult> {
      const { runWorkflowDirect } = await import("./workflow-tool.js");
      if (!deps.manager) throw new Error("runWorkflow requires manager in SDKDeps");
      const runtimeCtx = buildRuntimeCtx({
        bus: deps.bus,
        persistDir: deps.persistDir,
        projectRoot: deps.projectRoot,
        agentsRoot: deps.agentsRoot,
        sharedRoot: deps.sharedRoot,
        projectsRoot: deps.projectsRoot,
        agentName: deps.agentName,
      });
      const agentForWorkflow = opts?.source ?? deps.agentName;
      const projectWorkflowDir = projectWorkflowDirFor(deps.projectsRoot, opts?.projectId);
      const { result, runId } = await runWorkflowDirect({
        workflowName: name,
        task,
        manager: deps.manager,
        runtimeCtx,
        agentName: agentForWorkflow,
        persistDir: deps.persistDir,
        workflowDir: join(deps.agentsRoot, agentForWorkflow, "workflows"),
        sharedWorkflowDir: join(deps.sharedRoot, "workflows"),
        projectWorkflowDir,
        guardsDir: join(deps.agentsRoot, agentForWorkflow, "guards"),
        sharedGuardsDir: join(deps.sharedRoot, "guards"),
        projectId: opts?.projectId,
      });
      return { status: result.type === "done" ? "done" : "escalated", summary: result.type === "done" ? result.summary : result.reason ?? "escalated", runId };
    },

    emit(type: string, data?: Record<string, unknown>, envelope?: { owner?: string; source?: string; urgency?: string; ttl_ms?: number }): void {
      deps.bus.emit({
        type,
        source: envelope?.source ?? `agent:${deps.agentName}`,
        owner: normalizeOwner(envelope?.owner ?? deps.agentName),
        ...(envelope?.urgency ? { urgency: envelope.urgency } : {}),
        ...(typeof envelope?.ttl_ms === "number" ? { ttl_ms: envelope.ttl_ms } : {}),
        data: data ?? {},
      } as any);
    },

    getDb(): SqliteDb {
      return getDb(deps.persistDir);
    },

    query: createQueryService({
      getDb: () => getDb(deps.persistDir),
    }),

    metrics: createMetricService({
      getDb: () => getDb(deps.persistDir),
      emit: (type, data, envelope) => deps.bus.emit({
        type,
        source: envelope?.source ?? `agent:${deps.agentName}`,
        owner: normalizeOwner(envelope?.owner ?? deps.agentName),
        ...(envelope?.urgency ? { urgency: envelope.urgency } : {}),
        ...(typeof envelope?.ttl_ms === "number" ? { ttl_ms: envelope.ttl_ms } : {}),
        data: data ?? {},
      } as any),
      measuredBy: `agent:${deps.agentName}`,
      log: (msg) => globalLog("info", `[${deps.agentName}] ${msg}`),
    }),

    log(level: "info" | "warn" | "error", msg: string): void {
      globalLog(level, `[${deps.agentName}] ${msg}`);
    },

    message(target: string, content: string): void {
      const to = target;
      deps.bus.emit({
        type: "message.created",
        source: `agent:${deps.agentName}`,
        owner: messageOwner(to),
        data: {
          from: deps.agentName,
          to,
          content,
          priority: "P2",
        },
      } as any);
    },

    escalate(reason: string, opts?: EscalationOptions): void {
      if (typeof (opts as unknown) === "string") {
        throw new Error("sdk.escalate(reason, opts?) no longer accepts sdk.escalate(target, reason); pass { owner } in opts");
      }
      opts = opts ?? {};
      const owner = normalizeOwner(opts.owner);
      const severity = opts.severity ?? "P2";
      const escalationId = createEscalationId();
      const requestedAction = opts.requestedAction ?? `Investigate and resolve or answer this blocker: ${reason}`;
      const event = {
        type: "escalation.created",
        source: opts.source ?? `agent:${deps.agentName}`,
        owner,
        urgency: opts.urgency ?? urgencyForSeverity(severity),
        ...(typeof opts.ttl_ms === "number" ? { ttl_ms: opts.ttl_ms } : {}),
        data: {
          escalationId,
          sourceAgent: deps.agentName,
          ...(opts.sourceSessionId ? { sourceSessionId: opts.sourceSessionId } : {}),
          ...(opts.projectId ? { projectId: opts.projectId } : {}),
          reason,
          requestedAction,
          severity,
          ...(opts.evidence ? { evidence: opts.evidence } : {}),
          ...(opts.resume ? { resume: opts.resume } : {}),
          ...(opts.dedupKey ? { dedupKey: opts.dedupKey } : {}),
        },
      };

      // Persist to escalations.jsonl (survives restarts)
      try {
        const escalationPath = resolve(deps.persistDir, "escalations.jsonl");
        const entry = JSON.stringify({
          ts: new Date().toISOString(),
          escalationId,
          agent: deps.agentName,
          owner,
          reason,
        });
        appendFileSync(escalationPath, entry + "\n", "utf-8");
      } catch { /* best-effort */ }

      deps.bus.emit(event as any);
    },

    paths: {
      persist: deps.persistDir,
      root: deps.projectRoot,
      agents: deps.agentsRoot,
      shared: deps.sharedRoot,
      projects: deps.projectsRoot,
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

    escalate(reason: string, opts?: EscalationOptions): void {
      if (typeof (opts as unknown) === "string") {
        throw new Error("sdk.escalate(reason, opts?) no longer accepts sdk.escalate(target, reason); pass { owner } in opts");
      }
      deps.finish({ status: "escalated", summary: reason });
    },
  };
}
