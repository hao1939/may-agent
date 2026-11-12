import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  codexGoalBindingKey,
  readCodexGoalBindings,
  type CodexGoalBinding,
} from "../adapters/executors/codex/codex-goal-bindings.js";
import { CodexGoalAppServerClient, type CodexThreadItemsPage } from "../adapters/executors/codex/codex-goal-client.js";

type JsonRecord = Record<string, unknown>;

/** Reading a transcript never resumes a thread or activates its goal. */
export type TaskTranscriptCodexClient = {
  initialize(): Promise<void>;
  readThread(threadId: string, includeTurns?: boolean): Promise<unknown>;
  listThreadItems(input: {
    threadId: string;
    turnId?: string;
    cursor?: string;
    limit?: number;
    sortDirection?: "asc" | "desc";
  }): Promise<CodexThreadItemsPage>;
  stop(): Promise<void>;
};

export type TaskTranscriptItem = {
  id: string;
  role: "user" | "assistant" | "tool";
  type: "message" | "command" | "tool";
  text: string;
  timestamp?: string | number;
  command?: string;
  status?: string;
};

type TaskIdentity = { appId: string; taskId: string; generation: number };
type TranscriptCursor = TaskIdentity & {
  v: 1;
  threadId: string;
  itemCursor: string;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;
const MAX_NATIVE_PAGES = 16;
const MAX_TEXT_CHARS = 16_000;
const MAX_COMMAND_CHARS = 2_000;
const MAX_TOOL_OUTPUT_CHARS = 4_000;
const MAX_BINDING_FILE_BYTES = 16 * 1024 * 1024;
const MAX_CURSOR_CHARS = 12_288;
const READ_TIMEOUT_MS = 8_000;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.length > limit ? `${value.slice(0, limit)}\n[truncated]` : value;
}

function timestamp(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1_000 : value;
  if (typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value))) return value;
  return undefined;
}

function status(value: unknown): string | undefined {
  const candidate = typeof value === "string" ? value : record(value)?.type;
  return typeof candidate === "string" && candidate.length <= 64 ? candidate : undefined;
}

function contentText(value: unknown): string {
  if (typeof value === "string") return text(value, MAX_TEXT_CHARS);
  if (!Array.isArray(value)) return "";
  let result = "";
  for (const entry of value) {
    const block = record(entry);
    if (block?.type !== "text" && block?.type !== "input_text" && block?.type !== "output_text") continue;
    result += text(block.text, Math.max(0, MAX_TEXT_CHARS - result.length));
    if (result.length >= MAX_TEXT_CHARS) break;
  }
  return result;
}

function generatedGoalScaffold(value: string, identity: TaskIdentity): boolean {
  const prefix = `Achieve May Task ${identity.appId}/${identity.taskId} generation `;
  if (!value.startsWith(prefix)) return false;
  return /^[1-9]\d*: /.test(value.slice(prefix.length));
}

function privateScaffold(value: string, identity: TaskIdentity): boolean {
  return (
    value.includes("## Canonical May Task Attempt") ||
    value.startsWith("# Session Context") ||
    value.startsWith("You are the replaceable executor pursuing one fenced May Task goal.") ||
    generatedGoalScaffold(value, identity)
  );
}

/** Allowlisted visible items; never serialize reasoning, tool arguments, or raw native objects. */
function projectItem(
  value: unknown,
  turnId: string,
  identity: TaskIdentity,
  nativeTimestamp?: number | null,
): TaskTranscriptItem | null {
  const item = record(value);
  if (!item || typeof item.id !== "string" || !item.id || item.id.length > 512) return null;
  const id = `${turnId}:${item.id}`;
  const time =
    timestamp(item.timestamp ?? item.createdAt) ??
    (typeof nativeTimestamp === "number" && Number.isFinite(nativeTimestamp) ? nativeTimestamp : undefined);
  const common = { id, ...(time === undefined ? {} : { timestamp: time }) };
  if (item.type === "userMessage" || item.type === "agentMessage" || item.type === "message") {
    if (item.channel === "analysis" || item.phase === "analysis") return null;
    const role = item.type === "userMessage" ? "user" : item.type === "agentMessage" ? "assistant" : item.role;
    if (role !== "user" && role !== "assistant") return null;
    const body = typeof item.text === "string" ? text(item.text, MAX_TEXT_CHARS) : contentText(item.content);
    if (!body || privateScaffold(body, identity)) return null;
    return { ...common, role, type: "message", text: body };
  }
  const state = status(item.status);
  if (item.type === "commandExecution") {
    const command = text(item.command, MAX_COMMAND_CHARS);
    const output = text(item.aggregatedOutput, MAX_TOOL_OUTPUT_CHARS);
    return {
      ...common,
      role: "tool",
      type: "command",
      text: output,
      ...(command ? { command } : {}),
      ...(state ? { status: state } : {}),
    };
  }
  const toolNames: Record<string, string> = {
    mcpToolCall: "Tool call",
    dynamicToolCall: "Tool call",
    customToolCall: "Tool call",
    fileChange: "File changes",
    webSearch: "Web search",
    imageGeneration: "Image generation",
  };
  const toolType =
    typeof item.type === "string" && Object.hasOwn(toolNames, item.type) ? toolNames[item.type] : undefined;
  if (!toolType) return null;
  const name = text(item.tool ?? item.name, 160);
  return {
    ...common,
    role: "tool",
    type: "tool",
    text: name ? `${toolType}: ${name}` : toolType,
    ...(state ? { status: state } : {}),
  };
}

function matchingBinding(value: unknown, identity: TaskIdentity): value is CodexGoalBinding {
  const binding = record(value);
  return Boolean(
    binding &&
    binding.appId === identity.appId &&
    binding.taskId === identity.taskId &&
    binding.generation === identity.generation &&
    typeof binding.threadId === "string" &&
    binding.threadId.length > 0 &&
    binding.threadId.length <= 512 &&
    typeof binding.cwd === "string" &&
    binding.cwd.length <= 4_096 &&
    isAbsolute(binding.cwd),
  );
}

/** The daemon supplies Task identity; the executor's existing binding supplies native identity. */
export function createTaskTranscriptHandler(options: {
  daemonRead: (frame: JsonRecord) => Promise<JsonRecord>;
  json: (data: unknown, status?: number) => Response;
  stateDir: string;
  createCodexClient?: (cwd: string) => TaskTranscriptCodexClient;
}): (url: URL) => Promise<Response> {
  const { daemonRead, json } = options;
  const stateFile = join(options.stateDir, "codex-goal-bindings.json");
  const cursorSecret = randomBytes(32);
  const signature = (body: string) => createHmac("sha256", cursorSecret).update(body).digest();
  function encodeCursor(cursor: TranscriptCursor): string {
    const body = Buffer.from(JSON.stringify(cursor)).toString("base64url");
    return `${body}.${signature(body).toString("base64url")}`;
  }
  function decodeCursor(value: string, identity: TaskIdentity, threadId: string): TranscriptCursor {
    const parts = value.split(".");
    if (parts.length !== 2 || !parts.every((part) => /^[\w-]+$/.test(part))) throw new Error("Invalid cursor");
    const received = Buffer.from(parts[1], "base64url");
    const expected = signature(parts[0]);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid cursor");
    const cursor = record(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
    if (
      !cursor ||
      cursor.v !== 1 ||
      cursor.appId !== identity.appId ||
      cursor.taskId !== identity.taskId ||
      cursor.generation !== identity.generation ||
      cursor.threadId !== threadId ||
      typeof cursor.itemCursor !== "string" ||
      !cursor.itemCursor ||
      cursor.itemCursor.length > 4_096
    ) {
      throw new Error("Cursor does not match the current Task transcript");
    }
    return cursor as TranscriptCursor;
  }
  function readBinding(identity: TaskIdentity): CodexGoalBinding | null {
    if (existsSync(stateFile) && statSync(stateFile).size > MAX_BINDING_FILE_BYTES)
      throw new Error("Transcript binding state is too large");
    const bindings = readCodexGoalBindings(stateFile).bindings;
    const key = codexGoalBindingKey(identity.appId, identity.taskId);
    const candidate = Object.hasOwn(bindings, key) ? bindings[key] : undefined;
    return matchingBinding(candidate, identity) ? candidate : null;
  }
  async function readTask(appId: string, taskId: string): Promise<JsonRecord | null> {
    const response = await daemonRead({ type: "task.get", appId, taskId });
    if (response.type !== "ok" || !("task" in response)) throw new Error("Task read unavailable");
    if (response.task === null) return null;
    const task = record(response.task);
    if (
      !task ||
      task.appId !== appId ||
      task.taskId !== taskId ||
      !Number.isSafeInteger(task.generation) ||
      (task.generation as number) < 1
    ) {
      throw new Error("Task read returned a different identity");
    }
    return task;
  }
  return async (url) => {
    const appId = url.searchParams.get("appId")?.trim();
    const taskId = url.searchParams.get("taskId")?.trim();
    if (!appId || !taskId || appId.length > 512 || taskId.length > 512)
      return json({ error: "appId and taskId required (maximum 512 characters each)" }, 400);
    const allowed = new Set(["appId", "taskId", "cursor", "limit"]);
    if ([...url.searchParams.keys()].some((key) => !allowed.has(key) || url.searchParams.getAll(key).length !== 1))
      return json({ error: "Unsupported or repeated transcript query parameter" }, 400);
    const limitText = url.searchParams.get("limit");
    const limit = limitText === null ? DEFAULT_LIMIT : Number(limitText);
    const cursorText = url.searchParams.get("cursor");
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_LIMIT ||
      (limitText !== null && !/^\d+$/.test(limitText)) ||
      (cursorText !== null && (!cursorText || cursorText.length > MAX_CURSOR_CHARS))
    ) {
      return json({ error: "limit must be an integer from 1 to 100 and cursor must be bounded" }, 400);
    }
    let task: JsonRecord | null;
    try {
      task = await readTask(appId, taskId);
    } catch {
      return json({ error: "Current Task could not be read" }, 503);
    }
    if (!task) return json({ error: "Task not found" }, 404);
    const identity: TaskIdentity = { appId, taskId, generation: task.generation as number };
    const unavailable = (message: string, session: JsonRecord | null = null, code = 200) =>
      json({ ...identity, session, items: [], unavailable: message }, code);
    let binding: CodexGoalBinding | null;
    try {
      binding = readBinding(identity);
    } catch {
      return unavailable("Codex transcript binding state could not be read", null, 503);
    }
    if (!binding) {
      const sessionId = record(task.execution)?.sessionId;
      return typeof sessionId === "string" && sessionId
        ? unavailable("Managed-session transcripts are not available through this Task reader", {
            id: sessionId,
            kind: "may",
            status: status(task.status),
            updatedAt: timestamp(task.updatedAt),
          })
        : unavailable("No Codex transcript is bound to the current Task generation");
    }
    let cursor: TranscriptCursor | undefined;
    try {
      cursor = cursorText ? decodeCursor(cursorText, identity, binding.threadId) : undefined;
    } catch {
      return json({ error: "Invalid cursor for the current Task transcript" }, 400);
    }
    let client: TaskTranscriptCodexClient | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      client =
        options.createCodexClient?.(binding.cwd) ??
        CodexGoalAppServerClient.spawn({
          cwd: binding.cwd,
          command: process.env.MAY_CODEX_GOAL_COMMAND?.trim() || undefined,
          requestTimeoutMs: 5_000,
        });
      deadline = setTimeout(() => void client?.stop().catch(() => undefined), READ_TIMEOUT_MS);
      deadline.unref?.();
      await client.initialize();
      const response = record(await client.readThread(binding.threadId, false));
      const thread = record(response?.thread);
      if (!thread || thread.id !== binding.threadId) throw new Error("Invalid native transcript identity");
      let itemCursor = cursor?.itemCursor;
      let nextCursor: string | undefined;
      const items: TaskTranscriptItem[] = [];
      const seenCursors = new Set<string>();
      for (let pageIndex = 0; items.length < limit && pageIndex < MAX_NATIVE_PAGES; pageIndex++) {
        const remaining = limit - items.length;
        // Omitting turnId uses native thread-wide pagination, including active turns,
        // without materializing the full thread history in thread/read.
        const page = await client.listThreadItems({
          threadId: binding.threadId,
          ...(itemCursor ? { cursor: itemCursor } : {}),
          limit: remaining,
          sortDirection: "desc",
        });
        if (
          !Array.isArray(page?.data) ||
          page.data.length > remaining ||
          (page.nextCursor != null &&
            (typeof page.nextCursor !== "string" || !page.nextCursor || page.nextCursor.length > 4_096))
        ) {
          throw new Error("Invalid native transcript item page");
        }
        for (const entry of page.data) {
          if (!entry || typeof entry.turnId !== "string" || !entry.turnId || entry.turnId.length > 512)
            throw new Error("Invalid native transcript item turn");
          const item = projectItem(entry.item, entry.turnId, identity, entry.startedAtMs ?? entry.completedAtMs);
          if (item) items.push(item);
        }
        if (page.nextCursor) {
          if (page.nextCursor === itemCursor || seenCursors.has(page.nextCursor))
            throw new Error("Repeated native cursor");
          seenCursors.add(page.nextCursor);
          itemCursor = page.nextCursor;
        } else {
          nextCursor = undefined;
          break;
        }
        nextCursor = encodeCursor({ ...identity, v: 1, threadId: binding.threadId, itemCursor });
      }
      // A reopened Task or replaced binding must not receive the older execution's bytes.
      const currentTask = await readTask(appId, taskId);
      const currentBinding = currentTask?.generation === identity.generation ? readBinding(identity) : null;
      if (
        !currentTask ||
        !currentBinding ||
        currentBinding.threadId !== binding.threadId ||
        currentBinding.cwd !== binding.cwd
      )
        return unavailable("Task execution changed while reading; refresh the transcript", null, 409);
      return json({
        ...identity,
        session: {
          id: binding.threadId,
          kind: "codex",
          ...(status(thread.status) ? { status: status(thread.status) } : {}),
          ...(timestamp(thread.updatedAt ?? binding.updatedAt) === undefined
            ? {}
            : { updatedAt: timestamp(thread.updatedAt ?? binding.updatedAt) }),
        },
        items: items.reverse(),
        ...(nextCursor ? { nextCursor } : {}),
      });
    } catch {
      // Native errors may contain private stderr, paths, or provider diagnostics.
      return unavailable(
        "Codex transcript could not be read; execution was not resumed",
        {
          id: binding.threadId,
          kind: "codex",
        },
        503,
      );
    } finally {
      if (deadline) clearTimeout(deadline);
      if (client) await client.stop().catch(() => undefined);
    }
  };
}
