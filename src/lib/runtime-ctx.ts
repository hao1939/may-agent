/**
 * RuntimeCtx — internal infrastructure surface used by workflow-tool.
 *
 * Workflow execution adapts this into the narrow SDK context; it is never spread into App code.
 */

import type { EventBus } from "../app/core/events/bus.js";
import type { SqliteDb } from "./db.js";
import { getDb } from "./db/connection.js";
import { log as globalLog } from "./log.js";
import { createMetricService, type MetricService } from "./metrics.js";
import { buildCanonicalEventEnvelope } from "../../packages/control/src/event-envelope.js";

/**
 * RuntimeCtx — internal type for workflow/sdk infra.
 * Owns services used to implement scoped workflow capabilities and Host handlers.
 */
export interface RuntimeCtx {
  emit(event: { type: string; [key: string]: unknown }): void;
  getDb(): SqliteDb;
  log(msg: string): void;
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

function isSocketCommandType(type: string): boolean {
  return type.startsWith("trigger.");
}

function runtimeEventEnvelope(
  event: { type: string; [key: string]: unknown },
  agentName: string,
): { type: string; [key: string]: unknown } {
  if (!event.type.includes(".") || isSocketCommandType(event.type)) return event;
  return buildCanonicalEventEnvelope(event.type, event, {
    source: `agent:${agentName}`,
    owner: agentName,
  }) as { type: string; [key: string]: unknown };
}

export function buildRuntimeCtx(opts: RuntimeCtxOptions): RuntimeCtx {
  let metrics: MetricService | undefined;
  return {
    emit: (event) => opts.bus.emit(runtimeEventEnvelope(event, opts.agentName) as any),
    getDb: () => getDb(opts.persistDir),
    log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    get metrics() {
      return (metrics ??= createMetricService({
        getDb: () => getDb(opts.persistDir),
        emit: (type, data, envelope) =>
          opts.bus.emit(
            buildCanonicalEventEnvelope(
              type,
              {
                source: envelope?.source ?? `agent:${opts.agentName}`,
                owner: envelope?.owner,
                target: envelope?.target,
                urgency: envelope?.urgency,
                ttl_ms: envelope?.ttl_ms,
                data: data ?? {},
              },
              { owner: opts.agentName },
            ) as any,
          ),
        measuredBy: `agent:${opts.agentName}`,
        log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
      }));
    },
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
  };
}
