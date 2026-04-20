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
    getDb: () => getDb(opts.persistDir),
    log: (msg) => globalLog("info", `[${opts.agentName}] ${msg}`),
    notify: (msg) => opts.bus.emit({ type: "notification", agent: opts.agentName, text: msg }),
    persistDir: opts.persistDir,
    projectRoot: opts.projectRoot,
    agentsRoot: opts.agentsRoot,
  };
}
