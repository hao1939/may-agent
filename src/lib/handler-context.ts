/**
 * HandlerContext — the harness passed to agent-owned cron handlers.
 *
 * Each handler's create(ctx, entry) factory receives this context,
 * which provides everything the handler needs from the runtime.
 */

import type { SubagentManager } from "./index.js";
import type { CronEntry } from "./cron-tool.js";

export interface HandlerContext {
  /** SubagentManager — for run(), followUp(), etc. */
  manager: SubagentManager;

  /** Persistent state directory (e.g., .state/) */
  persistDir: string;

  /** Project root (e.g., /home/hao/may-agent) */
  projectRoot: string;

  /** Agents directory (e.g., /home/hao/may-agent/agents) */
  agentsRoot: string;

  /** Name of the agent that owns this handler (e.g., "may") */
  agentName: string;

  /** Agent's persistent session ID getter (for followUp). Returns null if no active session. */
  getSessionId: () => string | null;

  /** Log a diagnostic message (routed through EventBus as info). */
  log: (msg: string) => void;

  /** Send a message to the human (routed through EventBus on the chat channel, visible in Telegram). */
  notify: (msg: string) => void;

  /** Trigger a cron entry immediately (reactive trigger). Returns true if fired/latched. */
  triggerNow: (entryName: string) => boolean;
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
