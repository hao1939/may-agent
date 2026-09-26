/**
 * Host-internal MaintenanceAPI implementation wrapping existing services.
 *
 * Used by Host maintenance handlers, not the public bounded workflow SDK.
 */

import type { MaintenanceAPI } from "./maintenance-api.js";
import type { EventBus } from "../app/core/events/bus.js";
import type { SqliteDb } from "./db.js";
import { getDb } from "./db/connection.js";
import { log as globalLog } from "./log.js";
import { createMetricService } from "./metrics.js";
import { createQueryService } from "./query-service.js";
import { buildCanonicalEventEnvelope, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

// ── Dependencies (injected, not imported directly) ────────────────────

export interface MaintenanceAPIDeps {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  agentName: string;
}

function messageOwner(target: string): string {
  return normalizeEventOwner(target);
}

// ── Build MaintenanceAPI ────────────────────────────────────────────────────

export function buildMaintenanceAPI(deps: MaintenanceAPIDeps): MaintenanceAPI {
  let metrics: MaintenanceAPI["metrics"] | undefined;
  let query: MaintenanceAPI["query"] | undefined;
  return {
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
