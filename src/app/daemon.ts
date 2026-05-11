import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import {
  generateAutoHeartbeats,
  getAgentCrons,
  loadAgents,
} from "./agent-loader.js";
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

export async function prepareDaemonAgents(opts: {
  agentsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}): Promise<{ loaderOpts: AgentLoaderOptions }> {
  const loaderOpts: AgentLoaderOptions = {
    agentsRoot: opts.agentsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager: opts.manager,
    bus: opts.bus,
    cronEnabled: opts.cronEnabled,
  };

  const loadResult = await loadAgents(loaderOpts);
  console.log(`[agents] Loaded ${loadResult.added.length}: ${loadResult.added.join(", ")}`);
  opts.bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

  const autoHeartbeats = generateAutoHeartbeats(opts.agentsRoot);
  if (autoHeartbeats.length > 0) {
    const mayCron = getAgentCrons().get("may");
    if (mayCron) {
      for (const entry of autoHeartbeats) {
        mayCron.addSyntheticEntry(entry);
      }
      opts.bus.emit({ type: "info", message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map((e) => e.agent).join(", ")}` });
    }
  }

  for (const cron of getAgentCrons().values()) {
    cron.subscribeToBus(opts.bus);
  }

  let failures = 0;
  const heartbeatFiles = autoHeartbeats.map((entry) => {
    const agentWfDir = join(opts.agentsRoot, entry.agent!, "workflows");
    return join(agentWfDir, `${entry.agent}-heartbeat.ts`);
  }).filter((file) => existsSync(file));

  for (const file of heartbeatFiles) {
    try {
      await import(file);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${file.split("/").slice(-3).join("/")} — ${msg}` });
      console.error(`[startup-check] BROKEN WORKFLOW: ${file}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.` });
  }

  return { loaderOpts };
}

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
