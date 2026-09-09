/**
 * Host-internal AgentSDK implementation wrapping existing services.
 *
 * Used by Host maintenance handlers, not the public bounded workflow SDK.
 */

import type { AgentSDK, RunOpts, WorkflowResult } from "./sdk.js";
import type { EventBus } from "../app/core/events/bus.js";
import type { SqliteDb } from "./db.js";
import type { SubagentManager } from "./manager.js";
import { getDb } from "./requests.js";
import { log as globalLog } from "./log.js";
import { buildRuntimeCtx } from "./runtime-ctx.js";
import { createMetricService } from "./metrics.js";
import { createQueryService } from "./query-service.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { buildCanonicalEventEnvelope, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

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
}

// ── Workflow path helpers ──────────────────────────────────────────────

/**
 * Resolve the workflow directory for a App-local agent.
 * When an App provides its own agent (e.g. scout-knowledge-lib.app/agents/scout/),
 * the agent's workflows live at <projectId>.app/agents/<agent>/workflows/ rather than
 * the global agents/<agent>/workflows/ directory.
 */
export function agentWorkflowDirForApp(
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

  const appDirs = [join(projectsRoot, `${clean}.app`), join(projectsRoot, clean, ".app")];
  const shortName = basename(clean);
  if (shortName && shortName !== clean) {
    appDirs.push(join(projectsRoot, `${shortName}.app`));
    appDirs.push(join(projectsRoot, shortName, ".app"));
  }

  for (const appDir of appDirs) {
    const direct = join(appDir, "agents", agentName, "workflows");
    if (existsSync(direct)) return direct;
    const agentsDir = join(appDir, "agents");
    let entries: string[];
    try {
      entries = readdirSync(agentsDir);
    } catch {
      continue;
    }
    for (const entry of entries.sort()) {
      const configPath = join(agentsDir, entry, "agent.json");
      try {
        const config = JSON.parse(readFileSync(configPath, "utf8")) as { name?: unknown };
        if (config.name !== agentName) continue;
        const workflows = join(agentsDir, entry, "workflows");
        if (existsSync(workflows)) return workflows;
      } catch {
        // Ignore malformed or non-agent directories; registration reports them separately.
      }
    }
  }
  return undefined;
}

function messageOwner(target: string): string {
  return normalizeEventOwner(target);
}

// ── Build AgentSDK ────────────────────────────────────────────────────

export function buildAgentSDK(deps: SDKDeps): AgentSDK {
  let metrics: AgentSDK["metrics"] | undefined;
  let query: AgentSDK["query"] | undefined;
  return {
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
      const globalWorkflowDir = join(deps.agentsRoot, agentForWorkflow, "workflows");
      // When an App owns the agent (e.g. scout in scout-knowledge-lib.app/agents/scout/),
      // workflows live in the App-local agent dir, not the global agents/ dir.
      const appAgentWorkflowDir = agentWorkflowDirForApp(deps.projectsRoot, opts?.projectId, agentForWorkflow);
      const workflowDir = appAgentWorkflowDir ?? globalWorkflowDir;
      const { result, runId } = await runWorkflowDirect({
        workflowName: name,
        task,
        manager: deps.manager,
        runtimeCtx,
        agentName: agentForWorkflow,
        sessionSource: opts?.sessionSource,
        persistDir: deps.persistDir,
        workflowDir,
        guardsDir: join(deps.agentsRoot, agentForWorkflow, "guards"),
        sharedGuardsDir: join(deps.sharedRoot, "guards"),
        projectId: opts?.projectId,
        ...(opts?.input !== undefined ? { workflowInput: opts.input } : {}),
      });
      return {
        status: result.type === "done" ? "done" : "blocked",
        summary: result.type === "done" ? result.summary : (result.reason ?? "blocked"),
        runId,
      };
    },

    emit(
      type: string,
      data?: Record<string, unknown>,
      envelope?: {
        owner?: string;
        source?: string;
        target?: Record<string, unknown>;
        urgency?: string;
        ttl_ms?: number;
      },
    ): void {
      deps.bus.emit(
        buildCanonicalEventEnvelope(
          type,
          {
            source: envelope?.source ?? `agent:${deps.agentName}`,
            owner: envelope?.owner,
            target: envelope?.target,
            urgency: envelope?.urgency,
            ttl_ms: envelope?.ttl_ms,
            data: data ?? {},
          },
          { owner: deps.agentName },
        ) as any,
      );
    },

    getDb(): SqliteDb {
      return getDb(deps.persistDir);
    },

    get query() {
      return (query ??= createQueryService({
        getDb: () => getDb(deps.persistDir),
      }));
    },

    get metrics() {
      return (metrics ??= createMetricService({
        getDb: () => getDb(deps.persistDir),
        emit: (type, data, envelope) =>
          deps.bus.emit(
            buildCanonicalEventEnvelope(
              type,
              {
                source: envelope?.source ?? `agent:${deps.agentName}`,
                owner: envelope?.owner,
                target: envelope?.target,
                urgency: envelope?.urgency,
                ttl_ms: envelope?.ttl_ms,
                data: data ?? {},
              },
              { owner: deps.agentName },
            ) as any,
          ),
        measuredBy: `agent:${deps.agentName}`,
        log: (msg) => globalLog("info", `[${deps.agentName}] ${msg}`),
      }));
    },

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

    paths: {
      persist: deps.persistDir,
      root: deps.projectRoot,
      agents: deps.agentsRoot,
      shared: deps.sharedRoot,
      projects: deps.projectsRoot,
    },
  };
}
