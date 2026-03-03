/**
 * Unified event system for the runner.
 *
 * All agent activity flows through RunnerEvents. UI layers (console, socket,
 * web, log file) subscribe and render however they want. Commands flow back
 * through RunnerCommands.
 */

// ── Events (runner → UI) ──────────────────────────────────────────────

export type RunnerEvent =
  | { type: "text"; agent: string; text: string }
  | { type: "tool_call"; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "session_start"; agent: string; sessionId: string; task: string }
  | { type: "session_end"; agent: string; sessionId: string; status: string; duration?: string; error?: string }
  | { type: "workflow"; agent: string; workflow: string; event: "start" | "step_start" | "step_done" | "done" | "escalated"; step?: string; sessionId?: string; status?: string; duration?: string; reason?: string; task?: string }
  | { type: "eval"; verdict: string; efficiency: number; quality: number; tokens?: number; cost?: number; turns?: number; failureChains?: number; wastedCalls?: number }
  | { type: "info"; message: string }
  | { type: "prompt"; message: string };

// ── Commands (UI → runner) ─────────────────────────────────────────────

export type RunnerCommand =
  | { type: "steer"; message: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "cancel_task" }
  | { type: "close" }
  | { type: "status" }
  | { type: "input"; message: string }
  | { type: "run"; agent: string; message: string };

// ── Event Bus ──────────────────────────────────────────────────────────

export type EventListener = (event: RunnerEvent) => void;
export type CommandHandler = (command: RunnerCommand) => void;

export class EventBus {
  private listeners = new Set<EventListener>();
  private commandHandler: CommandHandler | null = null;

  /** Subscribe to all runner events. Returns unsubscribe function. */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Emit an event to all subscribers. */
  emit(event: RunnerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch { /* UI errors shouldn't crash the runner */ }
    }
  }

  /** Register the command handler (runner-side). */
  onCommand(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /** Send a command to the runner (UI-side). */
  command(cmd: RunnerCommand): void {
    this.commandHandler?.(cmd);
  }

  /** Number of listeners. */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
