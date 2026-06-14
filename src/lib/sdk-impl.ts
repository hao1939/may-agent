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
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

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
  callAgent: (
    agent: string,
    task: string,
    opts?: { source?: string; projectId?: string; timeout?: number },
  ) => Promise<TaskResult>;
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

  const candidates = [
    join(projectsRoot, `${clean}.app`, "workflows"),
    join(projectsRoot, clean, ".app", "workflows"),
    join(projectsRoot, clean, "workflows"),
  ];
  const shortName = basename(clean);
  if (shortName && shortName !== clean) {
    candidates.push(join(projectsRoot, `${shortName}.app`, "workflows"));
    candidates.push(join(projectsRoot, shortName, ".app", "workflows"));
    candidates.push(join(projectsRoot, shortName, "workflows"));
  }

  return candidates.find((dir) => existsSync(dir)) ?? candidates[candidates.length - 1];
}

/**
 * Resolve the workflow directory for a project-app-owned agent.
 * When a project app provides its own agent (e.g. scout-knowledge-lib.app/agents/scout/),
 * the agent's workflows live at <projectId>.app/agents/<agent>/workflows/ rather than
 * the global agents/<agent>/workflows/ directory.
 */
export function agentWorkflowDirForProjectApp(
  projectsRoot: string,
  projectId: string | undefined,
  agentName: string,
): string | undefined {
  if (!projectId || !agentName) return undefined;

  const clean = projectId
    .trim()
    .replace(/^projects\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
  if (!clean) return undefined;

  const candidates = [
    join(projectsRoot, `${clean}.app`, "agents", agentName, "workflows"),
    join(projectsRoot, clean, ".app", "agents", agentName, "workflows"),
  ];
  const shortName = basename(clean);
  if (shortName && shortName !== clean) {
    candidates.push(join(projectsRoot, `${shortName}.app`, "agents", agentName, "workflows"));
    candidates.push(join(projectsRoot, shortName, ".app", "agents", agentName, "workflows"));
  }

  return candidates.find((dir) => existsSync(dir));
}

function messageOwner(target: string): string {
  return normalizeEventOwner(target);
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
      const globalWorkflowDir = join(deps.agentsRoot, agentForWorkflow, "workflows");
      // When a project app owns the agent (e.g. scout in scout-knowledge-lib.app/agents/scout/),
      // workflows live in the project-app agent dir, not the global agents/ dir.
      const projectAppAgentWorkflowDir = agentWorkflowDirForProjectApp(
        deps.projectsRoot, opts?.projectId, agentForWorkflow,
      );
      const workflowDir = existsSync(globalWorkflowDir)
        ? globalWorkflowDir
        : (projectAppAgentWorkflowDir ?? globalWorkflowDir);
      const { result, runId } = await runWorkflowDirect({
        workflowName: name,
        task,
        manager: deps.manager,
        runtimeCtx,
        agentName: agentForWorkflow,
        persistDir: deps.persistDir,
        workflowDir,
        projectWorkflowDir,
        guardsDir: join(deps.agentsRoot, agentForWorkflow, "guards"),
        sharedGuardsDir: join(deps.sharedRoot, "guards"),
        projectId: opts?.projectId,
      });
      return {
        status: result.type === "done" ? "done" : "escalated",
        summary: result.type === "done" ? result.summary : (result.reason ?? "escalated"),
        runId,
      };
    },

    emit(
      type: string,
      data?: Record<string, unknown>,
      envelope?: { owner?: string; source?: string; urgency?: string; ttl_ms?: number },
    ): void {
      deps.bus.emit({
        type,
        source: envelope?.source ?? `agent:${deps.agentName}`,
        owner: normalizeEventOwner(envelope?.owner, deps.agentName),
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
      emit: (type, data, envelope) =>
        deps.bus.emit({
          type,
          source: envelope?.source ?? `agent:${deps.agentName}`,
          owner: normalizeEventOwner(envelope?.owner, deps.agentName),
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
        throw new Error(
          "sdk.escalate(reason, opts?) no longer accepts sdk.escalate(target, reason); pass { owner } in opts",
        );
      }
      opts = opts ?? {};
      const owner = normalizeEventOwner(opts.owner);
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
        throw new Error(
          "sdk.escalate(reason, opts?) no longer accepts sdk.escalate(target, reason); pass { owner } in opts",
        );
      }
      deps.finish({ status: "escalated", summary: reason });
    },
  };
}
