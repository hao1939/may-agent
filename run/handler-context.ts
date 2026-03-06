/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Each handler's create(ctx, entry) factory receives this context,
 * which provides everything the handler needs from the runtime.
 */

import type { SubagentManager } from "../src/index.js";
import type { CronEntry } from "../src/cron-tool.js";

export interface HandlerContext {
  /** SubagentManager — for run(), followUp(), etc. */
  manager: SubagentManager;

  /** Persistent state directory (e.g., .state/) */
  persistDir: string;

  /** Project root (e.g., /home/example-user/may-agent) */
  projectRoot: string;

  /** Agents directory (e.g., /home/example-user/may-agent/agents) */
  agentsRoot: string;

  /** Name of the agent that owns this handler (e.g., "may") */
  agentName: string;

  /** Agent's persistent session ID getter (for followUp). Returns null if no active session. */
  getSessionId: () => string | null;

  /** Emit a user-facing message (shows in console/telegram). */
  emit: (msg: string) => void;

  /** Log a diagnostic message (for internal bus events). */
  log: (msg: string) => void;
}

/**
 * The shape a handler module must export.
 *
 * The `create` factory is called once at startup. It receives the
 * HandlerContext (stable across fires) and the cron entry (for handlerConfig).
 * Returns the async function that runs on each cron fire.
 */
export interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => () => Promise<void>;
}
