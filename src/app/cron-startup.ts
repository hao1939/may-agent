import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";
import {
  getAgentCrons,
  getAgentSessionId,
  loadAgentHandlers,
  type AgentLoaderOptions,
} from "./agent-loader.js";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";

export interface CronRuntimeOptions {
  manager: SubagentManager;
  bus: EventBus;
  loaderOpts: AgentLoaderOptions;
  chatMode: boolean;
  chatSession?: ChatSession;
}

export async function startCronRuntime(options: CronRuntimeOptions): Promise<void> {
  const { manager, bus, loaderOpts, chatMode, chatSession } = options;

  const { resumed, interrupted } = manager.resumeStaleSessions({ kinds: ["job", "call"] });
  const orphansCleaned: typeof interrupted = [];
  if (!chatMode) {
    const { interrupted: chatCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["chat"] });
    orphansCleaned.push(...chatCleaned);
  } else {
    const { resumed: chatResumed } = manager.resumeStaleSessions({ kinds: ["chat"] });
    resumed.push(...chatResumed);
    chatSession?.resumeAfterLoad();
  }

  if (resumed.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Resumed ${resumed.length} session(s): ${resumed.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
  if (interrupted.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] ${interrupted.length} session(s) could not resume: ${interrupted.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
  if (orphansCleaned.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Cleaned up ${orphansCleaned.length} orphaned session(s): ${orphansCleaned.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }

  const handlerResult = await loadAgentHandlers({
    ...loaderOpts,
    getSessionId: (agentName: string) => getAgentSessionId(agentName) ?? null,
  });
  if (handlerResult.registered.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] Registered ${handlerResult.registered.length}: ${handlerResult.registered.join(", ")}`,
    });
  }
  if (handlerResult.errors.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] ${handlerResult.errors.length} error(s): ${handlerResult.errors.join("; ")}`,
    });
    for (const err of handlerResult.errors) {
      const handlerName = err.match(/"(\w[\w-]*)\.(js|ts)"/)?.[1] ?? err.match(/"([^"]+)"/)?.[1] ?? "unknown";
      log("warn", `[handlers] Failed to load handler "${handlerName}": ${err}`);
    }
  }

  for (const [name, cron] of getAgentCrons()) {
    cron.onFire((entry, executor) => {
      const handler = typeof entry.handler === "string"
        ? entry.handler
        : entry.handler
          ? `workflow:${entry.handler.agent ? `${entry.handler.agent}/` : ""}${entry.handler.workflow}`
          : entry.name;
      const label = executor === "handler" ? `handler -> ${handler}` : `agent -> ${entry.agent}`;
      bus.emit({
        type: "info",
        message: `[cron] ${entry.name} fired (${label})`,
      });
    });

    const entries = cron.getEntries();
    if (entries.length > 0) {
      bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
      cron.start();
    }
  }
}
