import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { ChatSession } from "./chat-session.js";

export async function startRequestedSession(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  interfaceAgent: string;
  initialTask: string | null;
  chatMode: boolean;
  envSessionId?: string;
  envParentSessionId?: string;
  envParentAgent?: string;
  emitPrompt: () => void;
  handleReload: () => Promise<void>;
  gracefulShutdown: () => void;
  gracefulRestart: () => void;
}): Promise<{ taskSessionId?: string; chatSession?: ChatSession }> {
  if (opts.initialTask && !opts.chatMode) {
    const taskSessionId = opts.manager.run(opts.interfaceAgent, opts.initialTask, {
      kind: "job",
      ...(opts.envSessionId ? { sessionId: opts.envSessionId } : {}),
      ...(opts.envParentSessionId ? { parentSessionId: opts.envParentSessionId } : {}),
      ...(opts.envParentAgent ? { parentAgentName: opts.envParentAgent } : {}),
    });
    opts.bus.emit({ type: "info", message: `[task] Started ${opts.interfaceAgent} task session: ${taskSessionId}` });
    await opts.manager.waitForIdle(taskSessionId);
    return { taskSessionId };
  }

  if (opts.chatMode) {
    const chatSession = new ChatSession({
      manager: opts.manager,
      bus: opts.bus,
      agentName: opts.interfaceAgent,
      persistDir: opts.persistDir,
      onDone: () => {
        opts.emitPrompt();
      },
      onReload: opts.handleReload,
      onClose: () => {
        opts.bus.emit({ type: "info", message: "[cmd] Closing..." });
        opts.gracefulShutdown();
      },
      onRestart: () => {
        opts.bus.emit({ type: "info", message: "[cmd] Restarting (supervisord will restart)..." });
        opts.gracefulRestart();
      },
    });

    opts.bus.emit({ type: "info", message: `[chat] Chat session ready. Agent: ${opts.interfaceAgent}` });
    return { chatSession };
  }

  opts.bus.emit({ type: "info", message: "[cron-only] No chat session. Running cron jobs only." });
  return {};
}
