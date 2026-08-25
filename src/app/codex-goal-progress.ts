// Projects bounded Codex observations onto Task-owned progress events.
import { createHash } from "node:crypto";
import type { AppEvent, TaskEventReceipt } from "@may-agent/sdk";
import type { AppServerNotification } from "./codex-goal-client.js";

type JsonRecord = Record<string, unknown>;

export type CodexGoalProgressProjection = {
  localKey: string;
  event: AppEvent<Record<string, unknown>>;
};

export type CodexGoalProgressStats = {
  queued: number;
  published: number;
  failed: number;
  dropped: number;
  lastError?: string;
};

export const CODEX_GOAL_PROGRESS_EVENT = "project.task.executor.progress";
export const DEFAULT_MAX_CODEX_GOAL_PROGRESS_EVENTS = 64;
export const MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS = 2_000;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function boundedString(value: unknown, max = 256): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

function rawString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function identityPart(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return rawString(value) ?? "none";
}

function stableLocalKey(kind: string, ...identity: unknown[]): string {
  const raw = ["codex-progress", kind, ...identity.map(identityPart)].join(":");
  if (raw.length <= 240) return raw;
  return `codex-progress:${kind}:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

function scopedLocalKey(localKey: string, scope: string | undefined): string {
  const normalized = scope?.trim();
  if (!normalized) return localKey;
  const raw = `${localKey}:attempt:${normalized}`;
  if (raw.length <= 240) return raw;
  return `codex-progress:attempt:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

function compactOpaqueId(value: string): string {
  if (value.length <= 128) return value;
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function projection(input: {
  localKey: string;
  executorName: string;
  threadId: string;
  turnId?: string | null;
  data: Record<string, unknown>;
}): CodexGoalProgressProjection {
  return {
    localKey: input.localKey,
    event: {
      type: CODEX_GOAL_PROGRESS_EVENT,
      data: {
        executor: input.executorName,
        threadId: input.threadId,
        ...(input.turnId ? { turnId: input.turnId } : {}),
        ...input.data,
      },
    },
  };
}

/**
 * Project the authoritative, low-volume app-server surface into one safe Task
 * event. Token/reasoning deltas and payload-heavy item fields are deliberately
 * ignored; the Task result remains the only terminal answer.
 */
export function projectCodexGoalProgress(
  notification: AppServerNotification,
  executorName = "codex-goal",
): CodexGoalProgressProjection | null {
  const params = record(notification.params);
  if (!params) return null;
  const threadId = boundedString(params.threadId);
  if (!threadId) return null;

  if (notification.method === "turn/started" || notification.method === "turn/completed") {
    const turn = record(params.turn);
    const turnId = boundedString(turn?.id);
    if (!turnId) return null;
    const stage = notification.method === "turn/started" ? "turn-started" : "turn-completed";
    const status = boundedString(turn?.status, 64);
    return projection({
      localKey: stableLocalKey(stage, threadId, turnId),
      executorName,
      threadId,
      turnId,
      data: { stage, ...(status ? { status } : {}) },
    });
  }

  if (notification.method === "thread/goal/updated") {
    const goal = record(params.goal);
    const status = boundedString(goal?.status, 64);
    if (!goal || !status) return null;
    const turnId = boundedString(params.turnId);
    const tokensUsed = finiteNumber(goal.tokensUsed);
    const timeUsedSeconds = finiteNumber(goal.timeUsedSeconds);
    return projection({
      // Status transitions matter; repeated usage updates while the status is
      // unchanged are heartbeat noise and would consume the durable event cap.
      localKey: stableLocalKey("goal-status", threadId, turnId, status),
      executorName,
      threadId,
      turnId,
      data: {
        stage: "goal-status",
        status,
        ...(tokensUsed !== null ? { tokensUsed } : {}),
        ...(timeUsedSeconds !== null ? { timeUsedSeconds } : {}),
      },
    });
  }

  if (notification.method !== "item/completed") return null;
  const turnId = boundedString(params.turnId);
  const item = record(params.item);
  const rawItemId = rawString(item?.id);
  const itemId = rawItemId ? compactOpaqueId(rawItemId) : null;
  const itemType = boundedString(item?.type, 64);
  if (!turnId || !item || !itemId || !itemType) return null;
  const base = { itemId, itemType };

  if (itemType === "agentMessage") {
    // A final answer is admitted through the terminal Task-result contract and
    // must not be duplicated as progress. Phase-less legacy messages are also
    // ignored because they cannot safely be classified as intermediate.
    if (item.phase !== "commentary") return null;
    const message = boundedString(item.text, MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS);
    if (!message) return null;
    return projection({
      localKey: stableLocalKey("item", threadId, turnId, rawItemId),
      executorName,
      threadId,
      turnId,
      data: { stage: "intermediate", ...base, message },
    });
  }

  if (itemType === "plan") {
    const message = boundedString(item.text, MAX_CODEX_GOAL_PROGRESS_MESSAGE_CHARS);
    if (!message) return null;
    return projection({
      localKey: stableLocalKey("item", threadId, turnId, rawItemId),
      executorName,
      threadId,
      turnId,
      data: { stage: "intermediate", ...base, message },
    });
  }

  if (itemType === "commandExecution") {
    const status = boundedString(item.status, 64);
    const exitCode = finiteNumber(item.exitCode);
    const durationMs = finiteNumber(item.durationMs);
    if (status === "completed" && (exitCode === null || exitCode === 0)) return null;
    return projection({
      localKey: stableLocalKey("item", threadId, turnId, rawItemId),
      executorName,
      threadId,
      turnId,
      data: {
        stage: "item-completed",
        ...base,
        ...(status ? { status } : {}),
        ...(exitCode !== null ? { exitCode } : {}),
        ...(durationMs !== null ? { durationMs } : {}),
        message: "Codex reported an unsuccessful command.",
      },
    });
  }

  if (itemType === "fileChange") {
    const status = boundedString(item.status, 64);
    return projection({
      localKey: stableLocalKey("item", threadId, turnId, rawItemId),
      executorName,
      threadId,
      turnId,
      data: {
        stage: "item-completed",
        ...base,
        ...(status ? { status } : {}),
        message: "Codex reported a file change during a read-only Task attempt.",
      },
    });
  }

  if (itemType === "mcpToolCall" || itemType === "dynamicToolCall") {
    const status = boundedString(item.status, 64);
    const durationMs = finiteNumber(item.durationMs);
    const server = itemType === "mcpToolCall" ? boundedString(item.server, 128) : null;
    const tool = boundedString(item.tool, 128);
    if (status === "completed") return null;
    return projection({
      localKey: stableLocalKey("item", threadId, turnId, rawItemId),
      executorName,
      threadId,
      turnId,
      data: {
        stage: "item-completed",
        ...base,
        ...(server ? { server } : {}),
        ...(tool ? { tool } : {}),
        ...(status ? { status } : {}),
        ...(durationMs !== null ? { durationMs } : {}),
        message: "Codex reported an unsuccessful tool call.",
      },
    });
  }

  return null;
}

function errorMessage(error: unknown): string {
  return boundedString(error instanceof Error ? error.message : String(error), 512) ?? "unknown publication error";
}

/** A non-blocking, serialized bridge from protocol notifications to Task events. */
export class CodexGoalProgressPublisher {
  private readonly publish: (localKey: string, event: AppEvent<Record<string, unknown>>) => Promise<TaskEventReceipt>;
  private readonly maxEvents: number;
  private readonly executorName: string;
  private readonly keyScope?: string;
  private readonly seen = new Set<string>();
  private tail: Promise<void> = Promise.resolve();
  private stats: CodexGoalProgressStats = { queued: 0, published: 0, failed: 0, dropped: 0 };

  constructor(input: {
    publish(localKey: string, event: AppEvent<Record<string, unknown>>): Promise<TaskEventReceipt>;
    maxEvents?: number;
    executorName?: string;
    keyScope?: string;
  }) {
    this.publish = input.publish;
    this.maxEvents = input.maxEvents ?? DEFAULT_MAX_CODEX_GOAL_PROGRESS_EVENTS;
    this.executorName = input.executorName ?? "codex-goal";
    this.keyScope = input.keyScope;
    if (!Number.isSafeInteger(this.maxEvents) || this.maxEvents <= 0) {
      throw new Error("Codex goal progress maxEvents must be a positive integer");
    }
  }

  observe(notification: AppServerNotification): void {
    const projected = projectCodexGoalProgress(notification, this.executorName);
    if (!projected) return;
    const localKey = scopedLocalKey(projected.localKey, this.keyScope);
    if (this.seen.has(localKey)) return;
    this.seen.add(localKey);
    if (this.stats.queued >= this.maxEvents) {
      this.stats.dropped += 1;
      return;
    }
    this.stats.queued += 1;
    this.tail = this.tail
      .then(async () => {
        await this.publish(localKey, projected.event);
        this.stats.published += 1;
      })
      .catch((error: unknown) => {
        this.stats.failed += 1;
        this.stats.lastError = errorMessage(error);
      });
  }

  async flush(): Promise<CodexGoalProgressStats> {
    await this.tail;
    return { ...this.stats };
  }
}
