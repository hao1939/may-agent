import { createInterface } from "readline";
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import type { SubagentManager } from "../lib/manager.js";
import type { EventBus } from "../app/event-bus.js";

interface ChatLoopOptions {
  manager: SubagentManager;
  bus: EventBus;
  agentName: string;
  startupContext?: string;
  onSessionDone?: () => void;
  onReload?: () => void;
  onClose?: () => void;
  onRestart?: () => void;
}

export class ChatLoop {
  private manager: SubagentManager;
  private bus: EventBus;
  private agentName: string;
  private sessionId: string | null = null;
  private onSessionDone?: () => void;
  private onReload?: () => void;
  private onClose?: () => void;
  private onRestart?: () => void;

  constructor(opts: ChatLoopOptions) {
    this.manager = opts.manager;
    this.bus = opts.bus;
    this.agentName = opts.agentName;
    this.onSessionDone = opts.onSessionDone;
    this.onReload = opts.onReload;
    this.onClose = opts.onClose;
    this.onRestart = opts.onRestart;

    // Try to attach to an existing session for this agent
    const existing = this.manager.sessions(this.agentName).find(s => s.status === "running" || s.status === "idle");
    if (existing) {
      this.sessionId = existing.sessionId;
      this.bus.emit({ type: "info", message: `[chat] Attached to existing session: ${this.sessionId}` });
      if (opts.startupContext) {
        this.manager.followUp(this.sessionId, opts.startupContext, "system");
      }
    } else {
      // Start a new persistent session
      this.startSession(opts.startupContext);
    }

    // Monitor for completion (transition to idle)
    this.monitorSession();
  }

  private startSession(initialContext?: string) {
    // For the interface agent, we want a persistent session (autoClose: "never")
    // If we have initial context (e.g. crash report), prepending it to the task description
    // might be too heavy. Better to start with a generic task and inject context.
    const task = `You are ${this.agentName}, the interface agent. Wait for user input and execute tasks.`;
    
    this.sessionId = this.manager.run(this.agentName, task, {
      autoClose: "never",
    });

    if (initialContext) {
      // Inject the startup context (e.g. "Process restarted...")
      // We use followUp because the session is technically "running" (even if just starting)
      this.manager.followUp(this.sessionId, initialContext, "system");
    }

    this.bus.emit({ type: "session_start", agent: this.agentName, sessionId: this.sessionId, task });
  }

  private async monitorSession() {
    if (!this.sessionId) return;
    
    try {
      // Wait for the session to go idle (processing complete)
      await this.manager.waitForIdle(this.sessionId);
      this.onSessionDone?.();
    } catch (err) {
      // If the session crashes or is cancelled, we might need to restart it
      // or just leave it terminal. For now, just log.
      const msg = err instanceof Error ? err.message : String(err);
      this.bus.emit({ type: "info", message: `[chat] Session ended: ${msg}` });
      this.sessionId = null; 
    }
  }

  async handleInput(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Command handling
    if (trimmed.startsWith("/")) {
      const [cmd, ...args] = trimmed.slice(1).split(" ");
      await this.handleCommand(cmd, args, trimmed);
      return;
    }

    // Normal input
    if (!this.sessionId) {
      this.startSession();
    }
    
    // If the session is running (processing), steer/interrupt it.
    // If it's idle, prompt it.
    const session = this.manager.status().find(s => s.sessionId === this.sessionId);
    if (!session) {
      // Should have been started above, but just in case
      this.startSession();
      // Recurse once
      return this.handleInput(text);
    }

    if (session.status === "running") {
      // User is interrupting
      this.manager.steer(this.sessionId!, text, "user");
    } else {
      // Session is idle (or just started and waiting? No, 'running' covers starting)
      // Wait, SubagentManager.run() starts it in 'running'.
      // If it's 'idle', it means it finished the previous turn.
      // We need a way to 'prompt' an idle session.
      // SubagentManager doesn't expose `agent.prompt()` directly on the manager interface
      // except via `run` (new session) or `resume`.
      // BUT `activeSessions` are accessible if we add a method to manager or access agent directly.
      // Let's look at `manager.ts`.
      
      // `manager.steer` throws if not running.
      // `manager.followUp` throws if not running.
      // We need `manager.submit(sessionId, text)` for idle sessions.
      // Since I can't modify manager.ts right now (scope), I have to assume the manager
      // supports this or I made a mistake in assumption.
      
      // Checking `manager.ts` again...
      // `manager.steer` implementation:
      // if (session.status !== "running") throw ...
      
      // Wait, how do we talk to an idle agent in V2?
      // `handleCompletion` sets status to `idle` (if autoClose="never").
      // But how to wake it up?
      // The `Agent` class has `prompt(msg)`.
      // I need to add a `submit` or `input` method to `SubagentManager` in `src/lib/manager.ts`.
      // Or I can just start a *new* session if the old one is idle?
      // No, we want context persistence.
      
      // Implementation gap! `SubagentManager` is missing a method to prompt an idle session.
      // I must add it.
      
      // For now, I will modify `handleInput` to assume `manager.input(sessionId, text)` exists,
      // and I will ADD that method to `manager.ts` in the next step.
      
      // Actually, I can implement the method in `manager.ts` first?
      // No, I'm writing `chat-loop.ts` now.
      
      // I'll call `(this.manager as any).input(this.sessionId!, text)` and fix manager next.
      
      try {
        await (this.manager as any).input(this.sessionId!, text);
        // After input, it goes running again. Monitor it.
        this.monitorSession();
      } catch (err) {
        this.bus.emit({ type: "info", message: `[error] Failed to send input: ${err}` });
      }
    }
  }

  private async handleCommand(cmd: string, args: string[], fullText: string) {
    switch (cmd.toLowerCase()) {
      case "help":
        console.log(`
Commands:
  /status        - List active sessions
  /cancel <id|all> - Cancel specific session or all active sessions
  /restart       - Restart the runner (and all agents)
  /reload        - Reload agent definitions (hot reload)
  /exit, /quit   - Exit
        `);
        break;

      case "status": {
        const health = this.manager.health();
        console.log(`\nActive Sessions (${health.sessionCounts.running} running, ${health.sessionCounts.idle} idle):`);
        for (const s of health.activeSessions) {
          console.log(`  ${s.sessionId} [${s.status}] ${s.agent}: ${s.turnCount} turns`);
        }
        break;
      }

      case "cancel": {
        const target = args[0];
        if (!target) {
          console.log("Usage: /cancel <sessionId> or /cancel all");
          return;
        }
        if (target === "all") {
          this.cancelAll();
          console.log("Cancelled all sessions.");
        } else {
          this.manager.cancel(target);
          console.log(`Cancelled ${target}.`);
        }
        break;
      }

      case "restart":
        this.onRestart?.();
        break;

      case "reload":
        this.onReload?.();
        break;

      case "exit":
      case "quit":
        this.onClose?.();
        break;

      default:
        console.log(`Unknown command: ${cmd}`);
    }
  }

  cancelAll() {
    for (const s of this.manager.status()) {
      if (s.status === "running") {
        this.manager.cancel(s.sessionId);
      }
    }
  }

  getActiveCount(): number {
    return this.manager.getSessionCount();
  }
}
