import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  taskAgentResultSchema,
  type AppEvent,
  type TaskAttempt,
  type TaskExecutor,
  type TaskReconcileResult,
} from "@may-agent/sdk";
import {
  CodexGoalAppServerClient,
  type AppServerNotification,
  type CodexGoalObservation,
  type CodexTurnCompletion,
} from "./codex-goal-client.js";
import { buildCanonicalTaskAttemptPacket, renderCodexGoalTaskAttempt } from "./codex-goal-packet.js";
import { admitCodexGoalTaskResult } from "./codex-goal-result.js";
import {
  CodexGoalProgressPublisher,
  DEFAULT_MAX_CODEX_GOAL_PROGRESS_EVENTS,
  type CodexGoalProgressStats,
} from "./codex-goal-progress.js";

type Binding = {
  appId: string;
  taskId: string;
  generation: number;
  threadId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  staleInterrupts: number;
};

type BindingFile = { version: 1; bindings: Record<string, Binding> };

export type CodexGoalClient = {
  initialize(): Promise<void>;
  startThread(input: {
    cwd: string;
    developerInstructions?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  }): Promise<{ threadId: string; cwd: string }>;
  resumeThread(input: {
    threadId: string;
    cwd: string;
    developerInstructions?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  }): Promise<{ threadId: string; cwd: string }>;
  setGoal(input: {
    threadId: string;
    objective: string;
    status?: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
  }): Promise<unknown>;
  waitForActiveTurn(threadId: string, timeoutMs?: number): Promise<string>;
  waitForGoal(
    threadId: string,
    accept: (observation: CodexGoalObservation) => boolean,
    timeoutMs?: number,
  ): Promise<CodexGoalObservation>;
  waitForTurn(turnId: string, timeoutMs?: number): Promise<CodexTurnCompletion>;
  readThread(threadId: string, includeTurns?: boolean): Promise<unknown>;
  steer(input: { threadId: string; turnId: string; message: string }): Promise<string>;
  interrupt(input: { threadId: string; turnId: string }): Promise<void>;
  onNotification(listener: (notification: AppServerNotification) => void): () => void;
  stop(): Promise<void>;
};

export type CodexGoalExecutorOptions = {
  stateFile: string;
  executorName?: string;
  command?: string;
  softStaleAfterMs?: number;
  hardStaleAfterMs?: number;
  checkIntervalMs?: number;
  turnTimeoutMs?: number;
  maxProgressEvents?: number;
  createClient?: (cwd: string) => CodexGoalClient;
  now?: () => number;
};

const DEFAULT_SOFT_STALE_MS = 2 * 60_000;
const DEFAULT_HARD_STALE_MS = 10 * 60_000;
const DEFAULT_CHECK_INTERVAL_MS = 5_000;
const DEFAULT_TURN_TIMEOUT_MS = 30 * 60_000;
const MAX_AGENT_INSTRUCTIONS_BYTES = 48 * 1024;
const MAX_PENDING_STEERING_EVENTS = 64;

function selectedAgentInstructions(attempt: TaskAttempt): string {
  const agent = attempt.task.agent?.trim() || "codex";
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(agent)) {
    return `Act as the selected May agent ${JSON.stringify(agent)}.`;
  }
  const path = join(attempt.cwd, "agents", agent, "AGENTS.md");
  if (!existsSync(path)) return `Act as the selected May agent ${agent}.`;
  const instructions = readFileSync(path, "utf8");
  if (Buffer.byteLength(instructions) <= MAX_AGENT_INSTRUCTIONS_BYTES) return instructions;
  return `${instructions.slice(0, MAX_AGENT_INSTRUCTIONS_BYTES)}\n\n[Selected agent instructions truncated by Runtime.]`;
}

function bindingKey(attempt: TaskAttempt): string {
  return `${attempt.appId}\u0000${attempt.task.id}`;
}

function readBindings(path: string): BindingFile {
  if (!existsSync(path)) return { version: 1, bindings: {} };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as BindingFile;
  if (parsed.version !== 1 || !parsed.bindings || typeof parsed.bindings !== "object") {
    throw new Error(`Invalid Codex goal binding file: ${path}`);
  }
  return parsed;
}

function writeBinding(path: string, key: string, binding: Binding): void {
  const state = readBindings(path);
  state.bindings[key] = binding;
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function finalAnswer(readResult: unknown, turnId: string): string | null {
  if (!readResult || typeof readResult !== "object") return null;
  const thread = (readResult as { thread?: unknown }).thread;
  if (!thread || typeof thread !== "object") return null;
  const turns = (thread as { turns?: unknown }).turns;
  if (!Array.isArray(turns)) return null;
  for (const turn of [...turns].reverse()) {
    if (!turn || typeof turn !== "object") continue;
    if ((turn as { id?: unknown }).id !== turnId) continue;
    const items = (turn as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const item of [...items].reverse()) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as { type?: unknown; phase?: unknown; text?: unknown };
      if (
        candidate.type === "agentMessage" &&
        candidate.phase === "final_answer" &&
        typeof candidate.text === "string"
      ) {
        return candidate.text;
      }
    }
  }
  return null;
}

function eventMessage(event: AppEvent<Record<string, unknown>>): string {
  return [
    "A new durable event was linked to the May Task while this turn was running.",
    "Treat it as feedback, steering, approval, cancellation, or a new fact according to its content:",
    JSON.stringify(event),
  ].join("\n");
}

function appendEvidence(result: TaskReconcileResult, ...additional: string[]): TaskReconcileResult {
  const unique = additional.filter(
    (item, index) => item && !result.evidence.includes(item) && additional.indexOf(item) === index,
  );
  if (unique.length === 0) return result;
  return {
    ...result,
    evidence: [...result.evidence.slice(0, Math.max(0, 32 - unique.length)), ...unique],
  };
}

function progressEvidence(stats: CodexGoalProgressStats): string[] {
  const evidence: string[] = [];
  if (stats.failed > 0) {
    evidence.push(
      `codex-progress-events:degraded failed=${stats.failed}${stats.lastError ? ` last=${stats.lastError}` : ""}`,
    );
  }
  if (stats.dropped > 0) evidence.push(`codex-progress-events:bounded dropped=${stats.dropped}`);
  return evidence;
}

function packetFor(attempt: TaskAttempt) {
  return buildCanonicalTaskAttemptPacket({
    identity: {
      appId: attempt.appId,
      taskId: attempt.task.id,
      generation: attempt.task.generation,
      resourceVersion: attempt.resourceVersion,
      attemptId: attempt.attemptId,
    },
    desired: {
      outcome: attempt.task.outcome,
      acceptance: attempt.task.acceptance,
      mode: attempt.task.mode ?? "achieve",
      input: attempt.task.input,
    },
    role: {
      agent: attempt.task.agent ?? "codex",
      instructions: [
        selectedAgentInstructions(attempt),
        "Keep working on this Task goal until its acceptance is supported or an exact external wait is identified. The workspace is read-only; cite exact evidence and do not mutate files or external systems.",
        "Progress commentary may become a durable Task event, so summarize without secret values, raw command output, tool payloads, or diffs.",
      ].join("\n\n"),
      capabilities: ["read-workspace", "publish-task-event", "receive-task-event"],
    },
    events: attempt.events,
    observations: { children: attempt.children, dependencies: [] },
    workspace: { cwd: attempt.cwd, declaredOutputPaths: attempt.declaredOutputPaths },
    contract: { resultSchema: structuredClone(taskAgentResultSchema) as unknown as Record<string, unknown> },
    limits: {
      deadlineAt: new Date(Date.now() + DEFAULT_TURN_TIMEOUT_MS).toISOString(),
      remainingTaskTokens: null,
      sandbox: "read-only",
    },
  });
}

export function createCodexGoalExecutor(options: CodexGoalExecutorOptions): TaskExecutor {
  const now = options.now ?? Date.now;
  const softStaleAfterMs = options.softStaleAfterMs ?? DEFAULT_SOFT_STALE_MS;
  const hardStaleAfterMs = options.hardStaleAfterMs ?? DEFAULT_HARD_STALE_MS;
  const checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  const turnTimeoutMs = options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS;
  const maxProgressEvents = options.maxProgressEvents ?? DEFAULT_MAX_CODEX_GOAL_PROGRESS_EVENTS;
  if (softStaleAfterMs <= 0 || hardStaleAfterMs <= softStaleAfterMs || checkIntervalMs <= 0) {
    throw new Error("Codex goal liveness timings must satisfy 0 < soft < hard and checkInterval > 0");
  }
  if (!Number.isSafeInteger(maxProgressEvents) || maxProgressEvents <= 0) {
    throw new Error("Codex goal progress maxProgressEvents must be a positive integer");
  }

  return async (attempt) => {
    const key = bindingKey(attempt);
    const existing = readBindings(options.stateFile).bindings[key];
    const rendered = renderCodexGoalTaskAttempt(packetFor(attempt));
    const client =
      options.createClient?.(attempt.cwd) ??
      CodexGoalAppServerClient.spawn({ cwd: attempt.cwd, command: options.command });
    let threadId = existing?.threadId ?? "";
    let turnId: string | null = null;
    const live = { goalStatus: "active" as CodexGoalObservation["goal"]["status"] };
    const updateGoalStatus = (status: CodexGoalObservation["goal"]["status"]) => {
      live.goalStatus = status;
    };
    let lastActivityAtMs = now();
    let nudgeCount = 0;
    let stopped = false;
    let liveInputOpen = true;
    const pendingEvents: Array<{ event: AppEvent<Record<string, unknown>>; accept: () => void }> = [];
    const incorporatedLiveEvents = new Set<() => void>();
    const steering = new Set<Promise<unknown>>();
    const progress = new CodexGoalProgressPublisher({
      publish: attempt.publish,
      maxEvents: maxProgressEvents,
      executorName: options.executorName ?? "codex-goal",
      keyScope: attempt.attemptId,
    });
    const finish = async (result: TaskReconcileResult): Promise<TaskReconcileResult> => {
      const stats = await progress.flush();
      return appendEvidence(result, ...progressEvidence(stats));
    };
    const track = (promise: Promise<unknown>) => {
      steering.add(promise);
      void promise.finally(() => steering.delete(promise));
    };
    const queueEvent = (event: AppEvent<Record<string, unknown>>, accept: () => void) => {
      if (pendingEvents.length >= MAX_PENDING_STEERING_EVENTS) pendingEvents.shift();
      pendingEvents.push({ event, accept });
    };
    const deliverPendingEvents = async (activeTurnId: string) => {
      const queued = pendingEvents.splice(0);
      for (let index = 0; index < queued.length; index += 1) {
        try {
          const queuedEvent = queued[index]!;
          await client.steer({ threadId, turnId: activeTurnId, message: eventMessage(queuedEvent.event) });
          incorporatedLiveEvents.add(queuedEvent.accept);
        } catch {
          if (!stopped) {
            for (const queuedEvent of queued.slice(index)) queueEvent(queuedEvent.event, queuedEvent.accept);
          }
          return;
        }
      }
    };
    const unsubscribeNotification = client.onNotification((notification) => {
      lastActivityAtMs = now();
      progress.observe(notification);
      if (notification.method === "turn/started") {
        const turn = notification.params?.turn;
        const nextTurnId =
          turn && typeof turn === "object" && typeof (turn as { id?: unknown }).id === "string"
            ? (turn as { id: string }).id
            : "";
        if (nextTurnId) {
          turnId = nextTurnId;
          if (liveInputOpen && pendingEvents.length > 0) track(deliverPendingEvents(nextTurnId));
        }
      } else if (notification.method === "turn/completed") {
        const turn = notification.params?.turn;
        const completedTurnId =
          turn && typeof turn === "object" && typeof (turn as { id?: unknown }).id === "string"
            ? (turn as { id: string }).id
            : "";
        if (completedTurnId && completedTurnId === turnId) turnId = null;
      }
      if (notification.method === "thread/goal/updated") {
        const status = notification.params?.goal;
        if (status && typeof status === "object" && typeof (status as { status?: unknown }).status === "string") {
          updateGoalStatus((status as { status: CodexGoalObservation["goal"]["status"] }).status);
        }
      }
    });
    const unsubscribeEvent = attempt.onEvent((event, accept = () => undefined) => {
      if (stopped || !liveInputOpen) return;
      if (!threadId || !turnId) {
        queueEvent(event, accept);
        return;
      }
      queueEvent(event, accept);
      track(deliverPendingEvents(turnId));
    });

    try {
      await client.initialize();
      const binding = existing
        ? await client.resumeThread({
            threadId: existing.threadId,
            cwd: attempt.cwd,
            sandbox: "read-only",
            developerInstructions: rendered.developerInstructions,
          })
        : await client.startThread({
            cwd: attempt.cwd,
            sandbox: "read-only",
            developerInstructions: rendered.developerInstructions,
          });
      threadId = binding.threadId;
      const persisted: Binding = {
        appId: attempt.appId,
        taskId: attempt.task.id,
        generation: attempt.task.generation,
        threadId,
        cwd: binding.cwd,
        createdAt: existing?.createdAt ?? new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString(),
        attempts: (existing?.attempts ?? 0) + 1,
        staleInterrupts: existing?.staleInterrupts ?? 0,
      };
      writeBinding(options.stateFile, key, persisted);

      let correction: string | null = null;
      while (true) {
        nudgeCount = 0;
        await client.setGoal({ threadId, objective: rendered.goalObjective, status: "active" });
        updateGoalStatus("active");
        lastActivityAtMs = now();
        turnId = await client.waitForActiveTurn(threadId, Math.min(turnTimeoutMs, 30_000));
        if (correction) await client.steer({ threadId, turnId, message: correction });
        correction = null;
        await deliverPendingEvents(turnId);

        const terminalGoalPromise = client
          .waitForGoal(threadId, (observation) => observation.goal.status !== "active", turnTimeoutMs)
          .then(
            (goal) => ({ kind: "goal" as const, goal }),
            (error: unknown) => ({ kind: "error" as const, error }),
          );
        let terminalGoal: CodexGoalObservation | null = null;
        while (!terminalGoal) {
          const outcome = await Promise.race([
            terminalGoalPromise,
            new Promise<{ kind: "tick" }>((resolve) => {
              const timer = setTimeout(() => resolve({ kind: "tick" }), checkIntervalMs);
              timer.unref?.();
            }),
          ]);
          if (outcome.kind === "goal") {
            terminalGoal = outcome.goal;
            updateGoalStatus(terminalGoal.goal.status);
            break;
          }
          if (outcome.kind === "error") throw outcome.error;
          const silentForMs = Math.max(0, now() - lastActivityAtMs);
          if (silentForMs >= hardStaleAfterMs) {
            await client.interrupt({ threadId, turnId });
            await client.waitForTurn(turnId, 30_000);
            persisted.staleInterrupts += 1;
            persisted.updatedAt = new Date(now()).toISOString();
            writeBinding(options.stateFile, key, persisted);
            throw new Error("Codex stopped responding and its turn was interrupted");
          }
          if (silentForMs >= softStaleAfterMs && nudgeCount === 0) {
            await client.steer({
              threadId,
              turnId,
              message: "Continue toward the Task goal. If something external is required, return the exact waiting condition.",
            });
            nudgeCount = 1;
            lastActivityAtMs = now();
          }
        }

        const completedTurnId = terminalGoal.turnId ?? turnId;
        const completion = await client.waitForTurn(completedTurnId, turnTimeoutMs);
        if (live.goalStatus === "usageLimited" || live.goalStatus === "budgetLimited") {
          throw new Error(`Codex stopped the current turn because it is ${live.goalStatus}`);
        }
        if (completion.turn.status !== "completed") {
          throw new Error(`Codex goal turn ended ${completion.turn.status}`);
        }
        const answer = finalAnswer(await client.readThread(threadId, true), completedTurnId);
        const admitted = admitCodexGoalTaskResult(answer, {
          allowNeedsAgent: false,
          defaultParentId: attempt.task.parentId,
        });
        if (admitted.kind === "retry") {
          correction = admitted.nextAttemptContext;
          continue;
        }
        liveInputOpen = false;
        unsubscribeEvent();
        await Promise.allSettled([...steering]);
        pendingEvents.length = 0;
        for (const accept of incorporatedLiveEvents) accept();
        return finish(appendEvidence(admitted.result, `codex-thread:${threadId}`));
      }
    } finally {
      stopped = true;
      unsubscribeEvent();
      unsubscribeNotification();
      await Promise.allSettled([...steering]);
      await progress.flush();
      await client.stop();
    }
  };
}

export const codexGoalExecutorInternals = {
  appendEvidence,
  bindingKey,
  finalAnswer,
  packetFor,
  progressEvidence,
  readBindings,
};
