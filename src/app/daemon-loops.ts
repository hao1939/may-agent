import { createInterface } from "node:readline";
import type { EventBus } from "./core/events/bus.js";
import type { SubagentManager } from "../lib/index.js";

export async function runInteractiveLoop(opts: {
  bus: EventBus;
  manager: SubagentManager;
  handleInput: (input: string, source: string) => void;
  gracefulShutdown: () => void;
  socketUI: { close: () => void };
  telegramBot: { close: () => void };
  setActiveReadline: (rl: ReturnType<typeof createInterface> | null) => void;
  isCancelLatched: () => boolean;
  latchCancel: () => void;
  emitPrompt: () => void;
}): Promise<void> {
  opts.emitPrompt();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  opts.setActiveReadline(rl);

  rl.on("SIGINT", () => {
    const running = opts.manager.status().filter((session) => session.status === "running");
    if (running.length > 0 && !opts.isCancelLatched()) {
      opts.latchCancel();
      opts.bus.emit({ type: "info", message: "\n[ctrl+c] Cancelling active sessions... (press again to force quit)" });
      for (const session of running) opts.manager.cancel(session.sessionId);
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
  const emitHeartbeat = () => {
    opts.bus.emit({
      type: "runtime.daemon.heartbeat",
      source: "daemon",
      owner: "agent:may",
      data: {
        pid: process.pid,
        interfaceAgent: opts.interfaceAgent,
        socketEnabled: opts.socketEnabled,
      },
    });
  };

  opts.bus.emit({
    type: "info",
    message: `[daemon] Running with the console disabled. Interface agent: ${opts.interfaceAgent}.${opts.socketEnabled ? " Use socket for control." : " Socket disabled — no external control available."}`,
  });

  emitHeartbeat();
  const heartbeatTimer = setInterval(emitHeartbeat, 60_000);

  process.stdin.on("end", () => {});
  process.stdin.resume();

  try {
    return await new Promise<never>(() => {});
  } finally {
    clearInterval(heartbeatTimer);
  }
}
