import { createInterface } from "node:readline";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { ChatSession } from "./chat-session.js";
export {
  createDaemonLifecycle,
  createIdentityWriter,
  formatDurationMs,
  type InstanceIdentity,
} from "./daemon-lifecycle.js";
export {
  attachDaemonEventSubscribers,
  attachEventPersistence,
} from "./daemon-events.js";
export { prepareDaemonAgents } from "./daemon-agents.js";

export async function runInteractiveLoop(opts: {
  bus: EventBus;
  manager: SubagentManager;
  chatSession: {
    isRunning: () => boolean;
    cancelAll: () => void;
  } | undefined;
  handleInput: (input: string, source: string) => void;
  gracefulShutdown: () => void;
  socketUI: { close: () => void };
  telegramBot: { close: () => void };
  setActiveReadline: (rl: ReturnType<typeof createInterface> | null) => void;
  isCancelLatched: () => boolean;
  latchCancel: () => void;
  emitPrompt: () => void;
}): Promise<void> {
  if (opts.chatSession) opts.emitPrompt();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  opts.setActiveReadline(rl);

  rl.on("SIGINT", () => {
    if (opts.chatSession && opts.chatSession.isRunning() && !opts.isCancelLatched()) {
      opts.latchCancel();
      opts.bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling active sessions... (press again to force quit)" });
      opts.chatSession.cancelAll();
      for (const session of opts.manager.status()) {
        if (session.status === "running") opts.manager.cancel(session.sessionId);
      }
      opts.emitPrompt();
    } else {
      opts.gracefulShutdown();
    }
  });

  let pasteBuffer: string[] = [];
  let pasteTimer: ReturnType<typeof setTimeout> | null = null;
  const pasteWindowMs = 50;

  const flushPaste = () => {
    pasteTimer = null;
    const joined = pasteBuffer.join("\n").trim();
    pasteBuffer = [];
    if (!joined) {
      opts.emitPrompt();
      return;
    }
    if (joined === "exit" || joined === "quit") {
      rl.close();
      return;
    }
    opts.handleInput(joined, "console");
  };

  rl.on("line", (line: string) => {
    pasteBuffer.push(line);
    if (pasteTimer) clearTimeout(pasteTimer);
    pasteTimer = setTimeout(flushPaste, pasteWindowMs);
  });

  await new Promise<void>((resolve) => {
    rl.on("close", () => {
      if (pasteTimer) {
        clearTimeout(pasteTimer);
        flushPaste();
      }
      opts.socketUI.close();
      opts.telegramBot.close();
      opts.setActiveReadline(null);
      resolve();
    });
  });
}

export async function runDaemonKeepalive(opts: {
  bus: EventBus;
  interfaceAgent: string;
  socketEnabled: boolean;
}): Promise<never> {
  opts.bus.emit({
    type: "info",
    message: `[daemon] Running in daemon mode (no TTY). Interface agent: ${opts.interfaceAgent}.${opts.socketEnabled ? " Use socket for control." : " Socket disabled — no external control available."}`,
  });

  setInterval(() => {}, 30_000);

  process.stdin.on("end", () => {});
  process.stdin.resume();

  return await new Promise<never>(() => {});
}

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
