import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";

type JsonRecord = Record<string, unknown>;

export type AppServerNotification = {
  method: string;
  params?: JsonRecord;
};

export type AppServerProcess = NodeJS.EventEmitter & {
  pid?: number;
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals): boolean;
};

export type CodexThreadBinding = {
  threadId: string;
  cwd: string;
};

export type CodexTurnCompletion = {
  threadId: string;
  turn: {
    id: string;
    status: "completed" | "interrupted" | "failed" | "inProgress";
    items?: unknown[];
    error?: unknown;
  };
};

export type CodexThreadGoal = {
  threadId: string;
  objective: string;
  status: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
  tokenBudget?: number | null;
  tokensUsed?: number;
  timeUsedSeconds?: number;
};

export type CodexGoalObservation = {
  threadId: string;
  turnId: string | null;
  goal: CodexThreadGoal;
};

export type CodexGoalProtocolDiagnostics = {
  processId: number | null;
  protocolBytes: number;
  protocolLines: number;
  notifications: number;
  responses: number;
  serverRequests: number;
  maxProtocolLineChars: number;
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_TURN_TIMEOUT_MS = 15 * 60_000;
const MAX_PROTOCOL_LINE_CHARS = 4 * 1024 * 1024;
const MAX_STDERR_CHARS = 64 * 1024;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function textInput(text: string): JsonRecord {
  return { type: "text", text, text_elements: [] };
}

/**
 * Isolated proof-of-concept JSONL client for Codex app-server.
 *
 * It is intentionally not imported by the production Task runtime. The PoC
 * proves protocol, resume, goal, steering, interruption, and process ownership
 * before the current `codex` executor is changed.
 */
export class CodexGoalPocClient {
  private readonly process: AppServerProcess;
  private readonly requestTimeoutMs: number;
  private readonly terminateAfterMs: number;
  private readonly killAfterMs: number;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<(notification: AppServerNotification) => void>();
  private readonly completions = new Map<string, CodexTurnCompletion>();
  private readonly activeTurns = new Map<string, string>();
  private readonly goals = new Map<string, CodexGoalObservation>();
  private readonly activeTurnWaiters = new Map<
    string,
    Set<{
      resolve(turnId: string): void;
      reject(error: Error): void;
      timeout: ReturnType<typeof setTimeout>;
    }>
  >();
  private readonly goalWaiters = new Map<
    string,
    Set<{
      accept(observation: CodexGoalObservation): boolean;
      resolve(observation: CodexGoalObservation): void;
      reject(error: Error): void;
      timeout: ReturnType<typeof setTimeout>;
    }>
  >();
  private readonly completionWaiters = new Map<
    string,
    Set<{
      resolve(value: CodexTurnCompletion): void;
      reject(error: Error): void;
      timeout: ReturnType<typeof setTimeout>;
    }>
  >();
  private nextId = 1;
  private stdoutBuffer = "";
  private stderrTail = "";
  private protocolBytes = 0;
  private protocolLines = 0;
  private notificationCount = 0;
  private responseCount = 0;
  private serverRequestCount = 0;
  private maxProtocolLineChars = 0;
  private processClosed = false;
  private stopPromise: Promise<void> | null = null;
  private exitError: Error | null = null;

  constructor(
    process: AppServerProcess,
    options: {
      requestTimeoutMs?: number;
      terminateAfterMs?: number;
      killAfterMs?: number;
    } = {},
  ) {
    this.process = process;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.terminateAfterMs = options.terminateAfterMs ?? 250;
    this.killAfterMs = options.killAfterMs ?? 1_250;
    if (this.terminateAfterMs < 0 || this.killAfterMs < this.terminateAfterMs) {
      throw new Error("Codex app-server shutdown timings must satisfy 0 <= terminateAfterMs <= killAfterMs");
    }
    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    process.stdout.on("data", (chunk: string) => this.consumeStdout(chunk));
    process.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-MAX_STDERR_CHARS);
    });
    process.once("error", (error) => this.fail(new Error(`Codex app-server process failed: ${errorMessage(error)}`)));
    process.once("close", (code, signal) => {
      this.processClosed = true;
      this.fail(
        new Error(
          `Codex app-server exited${code === null ? "" : ` with code ${code}`}${signal ? ` (${signal})` : ""}${
            this.stderrTail.trim() ? `: ${this.stderrTail.trim()}` : ""
          }`,
        ),
      );
    });
  }

  static spawn(options: {
    cwd: string;
    command?: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    requestTimeoutMs?: number;
  }): CodexGoalPocClient {
    const child = spawn(options.command ?? "codex", options.args ?? ["app-server"], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new CodexGoalPocClient(child as AppServerProcess, {
      requestTimeoutMs: options.requestTimeoutMs,
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: {
        name: "may_agent_codex_goal_poc",
        title: "May Agent Codex Goal PoC",
        version: "0.1.0",
      },
    });
    this.notify("initialized", {});
  }

  async startThread(input: {
    cwd: string;
    model?: string;
    developerInstructions?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  }): Promise<CodexThreadBinding> {
    const response = await this.request<{ thread: { id: string }; cwd?: string }>("thread/start", {
      cwd: input.cwd,
      approvalPolicy: "never",
      sandbox: input.sandbox ?? "read-only",
      ephemeral: false,
      ...(input.model ? { model: input.model } : {}),
      ...(input.developerInstructions ? { developerInstructions: input.developerInstructions } : {}),
    });
    return { threadId: response.thread.id, cwd: response.cwd ?? input.cwd };
  }

  async resumeThread(input: {
    threadId: string;
    cwd: string;
    model?: string;
    developerInstructions?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  }): Promise<CodexThreadBinding> {
    const response = await this.request<{ thread: { id: string }; cwd?: string }>("thread/resume", {
      threadId: input.threadId,
      cwd: input.cwd,
      approvalPolicy: "never",
      sandbox: input.sandbox ?? "read-only",
      ...(input.model ? { model: input.model } : {}),
      ...(input.developerInstructions ? { developerInstructions: input.developerInstructions } : {}),
    });
    return { threadId: response.thread.id, cwd: response.cwd ?? input.cwd };
  }

  async setGoal(input: {
    threadId: string;
    objective: string;
    status?: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
    tokenBudget?: number;
  }): Promise<unknown> {
    return await this.request("thread/goal/set", {
      threadId: input.threadId,
      objective: input.objective,
      status: input.status ?? "active",
      ...(input.tokenBudget === undefined ? {} : { tokenBudget: input.tokenBudget }),
    });
  }

  async getGoal(threadId: string): Promise<unknown> {
    return await this.request("thread/goal/get", { threadId });
  }

  async readThread(threadId: string, includeTurns = true): Promise<unknown> {
    return await this.request("thread/read", { threadId, includeTurns });
  }

  async startTurn(input: {
    threadId: string;
    prompt: string;
    cwd?: string;
    outputSchema?: JsonRecord;
  }): Promise<string> {
    const response = await this.request<{ turn: { id: string } }>("turn/start", {
      threadId: input.threadId,
      input: [textInput(input.prompt)],
      ...(input.cwd ? { cwd: input.cwd } : {}),
      ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
    });
    return response.turn.id;
  }

  async steer(input: { threadId: string; turnId: string; message: string }): Promise<string> {
    const response = await this.request<{ turnId: string }>("turn/steer", {
      threadId: input.threadId,
      expectedTurnId: input.turnId,
      input: [textInput(input.message)],
    });
    return response.turnId;
  }

  async interrupt(input: { threadId: string; turnId: string }): Promise<void> {
    await this.request("turn/interrupt", { threadId: input.threadId, turnId: input.turnId });
  }

  async waitForTurn(turnId: string, timeoutMs = DEFAULT_TURN_TIMEOUT_MS): Promise<CodexTurnCompletion> {
    const completed = this.completions.get(turnId);
    if (completed) return completed;
    if (this.exitError) throw this.exitError;
    return await new Promise<CodexTurnCompletion>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.completionWaiters.get(turnId);
        waiters?.delete(waiter);
        if (waiters?.size === 0) this.completionWaiters.delete(turnId);
        reject(new Error(`Timed out waiting for Codex turn ${turnId}`));
      }, timeoutMs);
      timeout.unref?.();
      const waiter = { resolve, reject, timeout };
      const waiters = this.completionWaiters.get(turnId) ?? new Set();
      waiters.add(waiter);
      this.completionWaiters.set(turnId, waiters);
    });
  }

  async waitForActiveTurn(threadId: string, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<string> {
    const active = this.activeTurns.get(threadId);
    if (active) return active;
    if (this.exitError) throw this.exitError;
    return await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.activeTurnWaiters.get(threadId);
        waiters?.delete(waiter);
        if (waiters?.size === 0) this.activeTurnWaiters.delete(threadId);
        reject(new Error(`Timed out waiting for an active Codex turn on thread ${threadId}`));
      }, timeoutMs);
      timeout.unref?.();
      const waiter = { resolve, reject, timeout };
      const waiters = this.activeTurnWaiters.get(threadId) ?? new Set();
      waiters.add(waiter);
      this.activeTurnWaiters.set(threadId, waiters);
    });
  }

  async waitForGoal(
    threadId: string,
    accept: (observation: CodexGoalObservation) => boolean,
    timeoutMs = DEFAULT_TURN_TIMEOUT_MS,
  ): Promise<CodexGoalObservation> {
    const current = this.goals.get(threadId);
    if (current && accept(current)) return current;
    if (this.exitError) throw this.exitError;
    return await new Promise<CodexGoalObservation>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.goalWaiters.get(threadId);
        waiters?.delete(waiter);
        if (waiters?.size === 0) this.goalWaiters.delete(threadId);
        reject(new Error(`Timed out waiting for Codex goal state on thread ${threadId}`));
      }, timeoutMs);
      timeout.unref?.();
      const waiter = { accept, resolve, reject, timeout };
      const waiters = this.goalWaiters.get(threadId) ?? new Set();
      waiters.add(waiter);
      this.goalWaiters.set(threadId, waiters);
    });
  }

  onNotification(listener: (notification: AppServerNotification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  diagnostics(): CodexGoalProtocolDiagnostics {
    return {
      processId: this.process.pid ?? null,
      protocolBytes: this.protocolBytes,
      protocolLines: this.protocolLines,
      notifications: this.notificationCount,
      responses: this.responseCount,
      serverRequests: this.serverRequestCount,
      maxProtocolLineChars: this.maxProtocolLineChars,
    };
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return await this.stopPromise;
    this.stopPromise = this.stopProcess();
    return await this.stopPromise;
  }

  private async stopProcess(): Promise<void> {
    this.fail(new Error("Codex app-server client stopped"));
    if (this.processClosed) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      let termTimer: ReturnType<typeof setTimeout> | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (termTimer) clearTimeout(termTimer);
        if (killTimer) clearTimeout(killTimer);
        resolve();
      };
      this.process.once("close", finish);
      if (this.processClosed) {
        finish();
        return;
      }
      try {
        this.process.stdin.end();
      } catch {
        // The process may still need explicit signaling below.
      }
      if (settled) return;
      termTimer = setTimeout(() => this.signalProcessTree("SIGTERM"), this.terminateAfterMs);
      killTimer = setTimeout(() => {
        this.signalProcessTree("SIGKILL");
        finish();
      }, this.killAfterMs);
      termTimer.unref?.();
      killTimer.unref?.();
    });
  }

  private request<T = unknown>(method: string, params: JsonRecord): Promise<T> {
    if (this.exitError) return Promise.reject(this.exitError);
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request ${method} timed out`));
      }, this.requestTimeoutMs);
      timeout.unref?.();
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
      try {
        this.write({ method, id, params });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(new Error(`Could not send ${method}: ${errorMessage(error)}`));
      }
    });
  }

  private notify(method: string, params: JsonRecord): void {
    this.write({ method, params });
  }

  private write(message: JsonRecord): void {
    if (this.exitError) throw this.exitError;
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private consumeStdout(chunk: string): void {
    this.protocolBytes += Buffer.byteLength(chunk);
    this.stdoutBuffer += chunk;
    while (true) {
      const newline = this.stdoutBuffer.indexOf("\n");
      if (newline < 0) {
        if (this.stdoutBuffer.length > MAX_PROTOCOL_LINE_CHARS) {
          this.fail(new Error(`Codex app-server protocol line exceeded ${MAX_PROTOCOL_LINE_CHARS} characters`));
        }
        return;
      }
      const line = this.stdoutBuffer.slice(0, newline).trimEnd();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      this.protocolLines += 1;
      this.maxProtocolLineChars = Math.max(this.maxProtocolLineChars, line.length);
      if (line.length > MAX_PROTOCOL_LINE_CHARS) {
        this.fail(new Error(`Codex app-server protocol line exceeded ${MAX_PROTOCOL_LINE_CHARS} characters`));
        return;
      }
      if (!line.trim()) continue;
      let message: JsonRecord;
      try {
        message = JSON.parse(line) as JsonRecord;
      } catch (error) {
        this.fail(new Error(`Codex app-server emitted invalid JSON: ${errorMessage(error)}`));
        return;
      }
      this.handleMessage(message);
    }
  }

  private handleMessage(message: JsonRecord): void {
    const id = typeof message.id === "number" ? message.id : null;
    if (id !== null && !("method" in message)) {
      this.responseCount += 1;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timeout);
      if (message.error && typeof message.error === "object") {
        const error = message.error as JsonRecord;
        pending.reject(new Error(typeof error.message === "string" ? error.message : JSON.stringify(error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (id !== null && typeof message.method === "string") {
      this.serverRequestCount += 1;
      // The PoC never grants an approval or supplies interactive input. A
      // production adapter must implement a small explicit server-request policy.
      this.write({
        id,
        error: {
          code: -32000,
          message: `May Codex goal PoC does not handle server request ${message.method}`,
        },
      });
      return;
    }

    if (typeof message.method !== "string") return;
    this.notificationCount += 1;
    const notification: AppServerNotification = {
      method: message.method,
      ...(message.params && typeof message.params === "object" ? { params: message.params as JsonRecord } : {}),
    };
    if (notification.method === "turn/started") this.recordActiveTurn(notification.params);
    if (notification.method === "turn/completed") this.recordCompletion(notification.params);
    if (notification.method === "thread/goal/updated") this.recordGoal(notification.params);
    for (const listener of this.listeners) listener(notification);
  }

  private recordCompletion(params: JsonRecord | undefined): void {
    if (!params || typeof params.threadId !== "string" || !params.turn || typeof params.turn !== "object") return;
    const turn = params.turn as JsonRecord;
    if (typeof turn.id !== "string" || typeof turn.status !== "string") return;
    const completion = params as unknown as CodexTurnCompletion;
    this.completions.set(turn.id, completion);
    if (this.activeTurns.get(params.threadId) === turn.id) this.activeTurns.delete(params.threadId);
    const waiters = this.completionWaiters.get(turn.id);
    if (!waiters) return;
    this.completionWaiters.delete(turn.id);
    for (const waiter of waiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve(completion);
    }
  }

  private recordActiveTurn(params: JsonRecord | undefined): void {
    if (!params || typeof params.threadId !== "string" || !params.turn || typeof params.turn !== "object") return;
    const turn = params.turn as JsonRecord;
    if (typeof turn.id !== "string") return;
    this.activeTurns.set(params.threadId, turn.id);
    const waiters = this.activeTurnWaiters.get(params.threadId);
    if (!waiters) return;
    this.activeTurnWaiters.delete(params.threadId);
    for (const waiter of waiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve(turn.id);
    }
  }

  private recordGoal(params: JsonRecord | undefined): void {
    if (!params || typeof params.threadId !== "string" || !params.goal || typeof params.goal !== "object") return;
    const goal = params.goal as JsonRecord;
    if (typeof goal.objective !== "string" || typeof goal.status !== "string") return;
    const observed: CodexGoalObservation = {
      threadId: params.threadId,
      turnId: typeof params.turnId === "string" ? params.turnId : null,
      goal: goal as unknown as CodexThreadGoal,
    };
    this.goals.set(params.threadId, observed);
    const waiters = this.goalWaiters.get(params.threadId);
    if (!waiters) return;
    for (const waiter of [...waiters]) {
      if (!waiter.accept(observed)) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timeout);
      waiter.resolve(observed);
    }
    if (waiters.size === 0) this.goalWaiters.delete(params.threadId);
  }

  private fail(error: Error): void {
    if (this.exitError) return;
    this.exitError = error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    for (const waiters of this.completionWaiters.values()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
    }
    this.completionWaiters.clear();
    for (const waiters of this.activeTurnWaiters.values()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
    }
    this.activeTurnWaiters.clear();
    for (const waiters of this.goalWaiters.values()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
    }
    this.goalWaiters.clear();
  }

  private signalProcessTree(signal: NodeJS.Signals): void {
    if (process.platform !== "win32" && this.process.pid) {
      try {
        process.kill(-this.process.pid, signal);
        return;
      } catch {
        // Fall back to direct child signaling.
      }
    }
    try {
      this.process.kill(signal);
    } catch {
      // Process may already be gone.
    }
  }
}
