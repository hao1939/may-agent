import { createHash } from "node:crypto";
import { Socket } from "node:net";
import { resolve } from "node:path";

const ALLOWED_COMMANDS = new Set([
  "apps.list",
  "app.tasks.list",
  "tasks.list",
  "app.task.get",
  "task.get",
  "event.get",
]);
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_BYTES = 1_000_000;

export type PublicCommand = (
  command: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
export type PublicTaskEvidenceProvider = {
  listApps(limit?: number): Promise<Record<string, unknown>[]>;
  listTasks(appId: string, limit?: number): Promise<Record<string, unknown>[]>;
  listTaskPage(
    appId: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ items: Record<string, unknown>[]; nextCursor: string }>;
  listRecentTaskPage(
    appId: string,
    limit?: number,
    cursor?: string,
  ): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string;
    issues: string[];
  }>;
  getAppTask(appId: string, taskId: string): Promise<Record<string, unknown>>;
  getTask(appId: string, taskId: string): Promise<Record<string, unknown>>;
  getEvent(eventId: string | number): Promise<Record<string, unknown>>;
};
export type SubjectDisposition =
  "eligible" | "excluded" | "insufficient-evidence";
export type SubjectEvidence = {
  disposition: SubjectDisposition;
  reason: string;
  appId: string;
  taskId: string;
  evidenceHash?: string;
  task?: Record<string, unknown>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalAppId(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/\.app$/, "");
}

function isEvaluation(value: unknown): boolean {
  return canonicalAppId(value) === "evaluation";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function configuredControlSocket(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (text(env.MAY_CONTROL_SOCKET)) return text(env.MAY_CONTROL_SOCKET);
  const persistDir = text(env.MAY_PERSIST_DIR) || "/app/.state";
  const instance = text(env.MAY_INSTANCE) || "background";
  const interfaceAgent = text(env.MAY_INTERFACE_AGENT) || "may";
  return resolve(persistDir, "instances", instance, `${interfaceAgent}.sock`);
}

export function sendPublicReadCommand(
  command: Record<string, unknown>,
  options: { socketPath?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<Record<string, unknown>> {
  const commandType = text(command.type);
  if (!ALLOWED_COMMANDS.has(commandType)) {
    return Promise.reject(
      new Error(
        `Public evidence command ${commandType || "<missing>"} is not allowed`,
      ),
    );
  }
  const socketPath = options.socketPath ?? configuredControlSocket();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  return new Promise((resolvePromise, reject) => {
    const socket = new Socket();
    let settled = false;
    let bytes = 0;
    let buffer = "";
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      callback();
    };
    const fail = (error: unknown) =>
      settle(() =>
        reject(error instanceof Error ? error : new Error(String(error))),
      );
    const timer = setTimeout(
      () =>
        fail(new Error(`Public evidence read timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    socket.setEncoding("utf8");
    socket.on("error", fail);
    socket.on("connect", () => socket.write(`${JSON.stringify(command)}\n`));
    socket.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes)
        return fail(
          new Error(`Public evidence response exceeded ${maxBytes} bytes`),
        );
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let response: Record<string, unknown>;
        try {
          response = object(JSON.parse(line));
        } catch {
          continue;
        }
        if (response.command !== commandType) continue;
        if (response.type === "error")
          return fail(
            new Error(text(response.message) || `${commandType} failed`),
          );
        if (response.type === "ok")
          return settle(() => resolvePromise(response));
      }
    });
    socket.on("close", () => {
      if (!settled)
        fail(
          new Error(
            `Public evidence socket closed before ${commandType} response`,
          ),
        );
    });
    socket.connect(socketPath);
  });
}

function boundedLimit(value: number | undefined): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(100, Math.trunc(value!)))
    : 50;
}

function assertIdentity(
  actual: unknown,
  expected: string,
  label: string,
): void {
  if (text(actual) !== expected) {
    throw new Error(`${label} identity mismatch`);
  }
}

/**
 * Bounded, read-only adapter over the Host's public control-socket contract.
 * It deliberately exposes no database, workspace scan, or private Task store.
 */
export function createPublicTaskEvidenceProvider(
  command: PublicCommand = sendPublicReadCommand,
): PublicTaskEvidenceProvider {
  return {
    async listApps(limit = 50) {
      const response = await command({
        type: "apps.list",
        limit: boundedLimit(limit),
      });
      if (response.command !== "apps.list")
        throw new Error("apps.list response identity mismatch");
      const envelope = response.apps;
      const items = Array.isArray(envelope) ? envelope : object(envelope).items;
      if (!Array.isArray(items))
        throw new Error("apps.list response has no items array");
      return items.map(object);
    },
    async listTaskPage(appId, limit = 50, cursor = "") {
      const response = await command({
        type: "app.tasks.list",
        appId,
        limit: boundedLimit(limit),
        ...(cursor ? { cursor } : {}),
      });
      if (response.command !== "app.tasks.list")
        throw new Error("app.tasks.list response identity mismatch");
      assertIdentity(response.appId, appId, "app.tasks.list appId");
      const envelope = response.tasks;
      const items = Array.isArray(envelope) ? envelope : object(envelope).items;
      if (!Array.isArray(items))
        throw new Error("app.tasks.list response has no items array");
      return {
        items: items.map(object),
        nextCursor: text(object(envelope).nextCursor ?? response.nextCursor),
      };
    },
    async listRecentTaskPage(appId, limit = 50, cursor = "") {
      const response = await command({
        type: "tasks.list",
        appId,
        includeDone: true,
        limit: boundedLimit(limit),
        ...(cursor ? { cursor } : {}),
      });
      if (response.command !== "tasks.list")
        throw new Error("tasks.list response identity mismatch");
      const envelope = object(response.tasks);
      const nextCursor = text(envelope.nextCursor);
      if (!Array.isArray(envelope.items))
        return {
          items: [],
          nextCursor,
          issues: ["tasks.list response has no items array"],
        };
      const items: Record<string, unknown>[] = [];
      const issues: string[] = [];
      for (const value of envelope.items) {
        const item = object(value);
        if (text(item.appId) !== appId) {
          issues.push("tasks.list item appId identity mismatch");
          continue;
        }
        if (!text(item.taskId)) {
          issues.push("tasks.list item has no taskId");
          continue;
        }
        const updatedAt = Number(item.updatedAt);
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
          issues.push("tasks.list item has no usable updatedAt");
          continue;
        }
        items.push(item);
      }
      return { items, nextCursor, issues };
    },
    async listTasks(appId, limit = 50) {
      const maximum = boundedLimit(limit);
      const collected: Record<string, unknown>[] = [];
      let cursor = "";
      do {
        const response = await command({
          type: "app.tasks.list",
          appId,
          limit: Math.min(50, maximum - collected.length),
          ...(cursor ? { cursor } : {}),
        });
        if (response.command !== "app.tasks.list")
          throw new Error("app.tasks.list response identity mismatch");
        assertIdentity(response.appId, appId, "app.tasks.list appId");
        const envelope = response.tasks;
        const items = Array.isArray(envelope)
          ? envelope
          : object(envelope).items;
        if (!Array.isArray(items))
          throw new Error("app.tasks.list response has no items array");
        collected.push(...items.map(object));
        cursor = text(object(envelope).nextCursor ?? response.nextCursor);
      } while (cursor && collected.length < maximum);
      return collected.slice(0, maximum);
    },
    async getAppTask(appId, taskId) {
      const response = await command({ type: "app.task.get", appId, taskId });
      if (response.command !== "app.task.get")
        throw new Error("app.task.get response identity mismatch");
      assertIdentity(response.appId, appId, "app.task.get appId");
      assertIdentity(response.taskId, taskId, "app.task.get taskId");
      const task = object(response.task);
      assertIdentity(task.id ?? task.taskId, taskId, "app.task.get Task");
      return task;
    },
    async getTask(appId, taskId) {
      const response = await command({ type: "task.get", appId, taskId });
      if (response.command !== "task.get")
        throw new Error("task.get response identity mismatch");
      const task = object(response.task);
      assertIdentity(task.appId, appId, "task.get appId");
      assertIdentity(task.taskId ?? task.id, taskId, "task.get taskId");
      return task;
    },
    async getEvent(eventId) {
      const response = await command({ type: "event.get", eventId });
      if (response.command !== "event.get")
        throw new Error("event.get response identity mismatch");
      const envelope = object(response.event);
      const event = Object.keys(object(envelope.event)).length
        ? object(envelope.event)
        : envelope;
      if (String(event.id ?? response.eventId) !== String(eventId)) {
        throw new Error("event.get eventId identity mismatch");
      }
      return event;
    },
  };
}

function creatorAppIds(task: Record<string, unknown>): string[] {
  const creator = object(task.creator);
  const source = object(creator.source);
  return [
    creator.appId,
    creator.app,
    creator.owner,
    source.appId,
    source.app,
    source.owner,
  ]
    .map(text)
    .filter(Boolean);
}

export function unresolvedReviewSubject(
  hintedAppId: unknown,
  taskId: unknown = "",
): SubjectEvidence {
  const appId = text(hintedAppId);
  const exactTaskId = text(taskId);
  if (isEvaluation(appId)) {
    return {
      disposition: "excluded",
      reason: "Evaluation-owned work is never an evaluation subject.",
      appId,
      taskId: exactTaskId,
    };
  }
  return {
    disposition: "insufficient-evidence",
    reason:
      "Authoritative subject ownership is unavailable; caller hints and session identity are not authority.",
    appId,
    taskId: exactTaskId,
  };
}

export async function readSubjectTask(
  subject: { appId: string; taskId: string },
  command: PublicCommand = sendPublicReadCommand,
): Promise<SubjectEvidence> {
  const appId = text(subject.appId);
  const taskId = text(subject.taskId);
  if (isEvaluation(appId)) return unresolvedReviewSubject(appId, taskId);
  if (!appId || !taskId) return unresolvedReviewSubject(appId, taskId);
  try {
    const provider = createPublicTaskEvidenceProvider(command);
    const apps = await provider.listApps();
    if (
      !apps.some(
        (app) => canonicalAppId(app.id ?? app.appId) === canonicalAppId(appId),
      )
    ) {
      return {
        disposition: "insufficient-evidence",
        reason: `App ${appId} is not present in the public catalog.`,
        appId,
        taskId,
      };
    }
    const appTask = await provider.getAppTask(appId, taskId);
    const detail = await provider.getTask(appId, taskId);
    if (
      appTask.generation !== undefined &&
      detail.generation !== undefined &&
      appTask.generation !== detail.generation
    ) {
      throw new Error("public Task generation mismatch");
    }
    const task = { appTask, detail };
    const creators = creatorAppIds(appTask);
    if (creators.length === 0)
      return {
        disposition: "insufficient-evidence",
        reason:
          "The authoritative App Task view has no creator provenance; ownership cannot be inferred from the detail view.",
        appId,
        taskId,
        task,
      };
    if (creators.some(isEvaluation))
      return {
        disposition: "insufficient-evidence",
        reason:
          "Evaluation created this cross-App Task; public provenance does not distinguish delegated review from independently owned remediation.",
        appId,
        taskId,
        task,
      };
    const evidenceHash = createHash("sha256")
      .update(stable({ appId, taskId, appTask, detail }))
      .digest("hex");
    return {
      disposition: "eligible",
      reason:
        "Catalog membership and matching App/detail Task identities verified.",
      appId,
      taskId,
      evidenceHash,
      task,
    };
  } catch (error) {
    return {
      disposition: "insufficient-evidence",
      reason: error instanceof Error ? error.message : String(error),
      appId,
      taskId,
    };
  }
}
