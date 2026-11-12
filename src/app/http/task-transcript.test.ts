import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { codexGoalBindingKey } from "../adapters/executors/codex/codex-goal-bindings.js";
import { CodexGoalAppServerClient, type AppServerProcess } from "../adapters/executors/codex/codex-goal-client.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";

type JsonRecord = Record<string, unknown>;
type FixtureTurn = { id: string; items: JsonRecord[] };

/** Local JSONL peer drives the shipped client, including initialization and shutdown. */
class TranscriptProcess extends EventEmitter implements AppServerProcess {
  pid = undefined;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  writes: JsonRecord[] = [];
  closed = false;

  constructor(
    turns: FixtureTurn[],
    options: {
      threadId?: string;
      errorMethod?: string;
      repeatedCursor?: boolean;
      invalidTurn?: boolean;
      onItems?: () => void;
    } = {},
  ) {
    super();
    let buffer = "";
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      buffer += chunk;
      for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
        const request = JSON.parse(buffer.slice(0, newline)) as JsonRecord;
        buffer = buffer.slice(newline + 1);
        this.writes.push(request);
        if (typeof request.id !== "number") continue;
        const reply = (result: unknown) => this.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        if (request.method === options.errorMethod) {
          this.stdout.write(
            `${JSON.stringify({ id: request.id, error: { message: "PRIVATE_PROVIDER_DIAGNOSTIC" } })}\n`,
          );
        } else if (request.method === "initialize") {
          reply({});
        } else if (request.method === "thread/read") {
          reply({
            thread: {
              id: options.threadId ?? "thread-fixture",
              status: { type: "active" },
              updatedAt: 1_800_000_000,
              // Metadata-only reads must work without full historical turns.
              turns: [],
            },
          });
        } else if (request.method === "thread/items/list") {
          options.onItems?.();
          const params = request.params as JsonRecord;
          const descending = turns
            .filter(({ id }) => params.turnId === undefined || params.turnId === id)
            .flatMap((turn) => turn.items.map((item) => ({ turnId: turn.id, item, startedAtMs: 1_800_000_000_123 })))
            .reverse();
          const offset = typeof params.cursor === "string" ? Number(params.cursor.replace("offset-", "")) : 0;
          const limit = params.limit as number;
          const next = offset + limit;
          reply({
            data: descending
              .slice(offset, next)
              .map((entry) => ({ ...entry, ...(options.invalidTurn ? { turnId: "" } : {}) })),
            nextCursor: options.repeatedCursor ? "repeated" : next < descending.length ? `offset-${next}` : null,
          });
        } else {
          this.stdout.write(
            `${JSON.stringify({ id: request.id, error: { message: `Forbidden request: ${String(request.method)}` } })}\n`,
          );
        }
      }
    });
    this.stdin.once("finish", () => {
      this.closed = true;
      this.emit("close", 0, null);
    });
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.closed = true;
    this.emit("close", 0, signal ?? null);
    return true;
  }
}

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(
  options: {
    turns?: FixtureTurn[];
    processOptions?: ConstructorParameters<typeof TranscriptProcess>[1];
    task?: JsonRecord | null;
    daemonRead?: (frame: JsonRecord) => Promise<JsonRecord>;
    binding?: JsonRecord | null;
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "may-task-transcript-"));
  roots.push(root);
  const task =
    options.task === undefined
      ? { appId: "sample", taskId: "review/one", generation: 1, status: "running" }
      : options.task;
  const binding =
    options.binding === undefined
      ? {
          appId: "sample",
          taskId: "review/one",
          generation: 1,
          threadId: "thread-fixture",
          cwd: root,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          attempts: 1,
          staleInterrupts: 0,
        }
      : options.binding;
  const stateFile = join(root, "codex-goal-bindings.json");
  if (binding)
    writeFileSync(
      stateFile,
      JSON.stringify({ version: 1, bindings: { [codexGoalBindingKey("sample", "review/one")]: binding } }),
    );
  const peers: TranscriptProcess[] = [];
  const frames: JsonRecord[] = [];
  const cwdReads: string[] = [];
  const handler = createTaskTranscriptHandler({
    stateDir: root,
    daemonRead: async (frame) => {
      frames.push(frame);
      return options.daemonRead ? await options.daemonRead(frame) : { type: "ok", task };
    },
    json: (body, status = 200) => Response.json(body, { status }),
    createCodexClient: (cwd) => {
      cwdReads.push(cwd);
      const peer = new TranscriptProcess(options.turns ?? [], options.processOptions);
      peers.push(peer);
      return new CodexGoalAppServerClient(peer, { requestTimeoutMs: 1_000 });
    },
  });
  const read = (query: Record<string, string> = {}) =>
    handler(
      new URL(
        `http://example.test/api/task/transcript?${new URLSearchParams({ appId: "sample", taskId: "review/one", ...query })}`,
      ),
    );
  return { root, stateFile, handler, read, peers, frames, cwdReads };
}

describe("Task transcript read", () => {
  it("reads an active bound native thread through the production client without activating it or writing state", async () => {
    const f = fixture({
      turns: [
        {
          id: "turn-1",
          items: [
            { id: "user-1", type: "userMessage", content: [{ type: "text", text: "Review the changes" }] },
            {
              id: "command-1",
              type: "commandExecution",
              command: "git diff --stat",
              aggregatedOutput: "2 files changed",
              status: "completed",
            },
            { id: "answer-1", type: "agentMessage", text: "Review finished", phase: "final_answer" },
          ],
        },
      ],
    });
    const before = readFileSync(f.stateFile, "utf8");
    const response = await f.read();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      appId: "sample",
      taskId: "review/one",
      generation: 1,
      session: { id: "thread-fixture", kind: "codex", status: "active", updatedAt: 1_800_000_000_000 },
      items: [
        {
          id: "turn-1:user-1",
          role: "user",
          type: "message",
          text: "Review the changes",
          timestamp: 1_800_000_000_123,
        },
        {
          id: "turn-1:command-1",
          role: "tool",
          type: "command",
          command: "git diff --stat",
          text: "2 files changed",
          status: "completed",
        },
        { id: "turn-1:answer-1", role: "assistant", text: "Review finished" },
      ],
    });
    expect(f.frames).toEqual([
      { type: "task.get", appId: "sample", taskId: "review/one" },
      { type: "task.get", appId: "sample", taskId: "review/one" },
    ]);
    expect(f.cwdReads).toEqual([f.root]);
    expect(f.peers[0].writes.map(({ method }) => method)).toEqual([
      "initialize",
      "initialized",
      "thread/read",
      "thread/items/list",
    ]);
    expect(f.peers[0].writes.find(({ method }) => method === "thread/read")?.params).toEqual({
      threadId: "thread-fixture",
      includeTurns: false,
    });
    expect(f.peers[0].writes.find(({ method }) => method === "thread/items/list")?.params).toEqual({
      threadId: "thread-fixture",
      limit: 30,
      sortDirection: "desc",
    });
    expect(f.peers[0].closed).toBe(true);
    expect(readFileSync(f.stateFile, "utf8")).toBe(before);
    expect(readdirSync(f.root)).toEqual(["codex-goal-bindings.json"]);
  });

  it("pages older history across native item pages and turns in chronological page order", async () => {
    const f = fixture({
      turns: [
        {
          id: "old",
          items: [
            { id: "u1", type: "userMessage", content: [{ type: "text", text: "First request" }] },
            { id: "a1", type: "agentMessage", text: "First answer" },
          ],
        },
        {
          id: "new",
          items: [
            { id: "u2", type: "userMessage", content: [{ type: "text", text: "Follow up" }] },
            { id: "r2", type: "reasoning", summary: ["PRIVATE_REASONING"] },
            { id: "c2", type: "commandExecution", command: "git status", status: "inProgress" },
            { id: "a2", type: "agentMessage", text: "Latest commentary" },
          ],
        },
      ],
    });
    const first = await (await f.read({ limit: "2" })).json();
    expect(first.items.map((item: JsonRecord) => item.id)).toEqual(["new:c2", "new:a2"]);
    expect(typeof first.nextCursor).toBe("string");
    const second = await (await f.read({ limit: "2", cursor: first.nextCursor })).json();
    expect(second.items.map((item: JsonRecord) => item.id)).toEqual(["old:a1", "new:u2"]);
    const third = await (await f.read({ limit: "2", cursor: second.nextCursor })).json();
    expect(third.items.map((item: JsonRecord) => item.id)).toEqual(["old:u1"]);
    expect(third.nextCursor).toBeUndefined();
    expect(f.peers.every((peer) => peer.closed)).toBe(true);
  });

  it("omits reasoning, private context, developer/system messages and raw tool payloads", async () => {
    const f = fixture({
      turns: [
        {
          id: "turn",
          items: [
            {
              id: "packet",
              type: "userMessage",
              content: [{ type: "text", text: "## Canonical May Task Attempt\nPRIVATE_PACKET" }],
            },
            {
              id: "goal",
              type: "userMessage",
              content: [{ type: "text", text: "Achieve May Task sample/review/one generation 1: PRIVATE_GOAL" }],
            },
            { id: "dev", type: "message", role: "developer", content: "PRIVATE_DEVELOPER" },
            { id: "sys", type: "message", role: "system", text: "PRIVATE_SYSTEM" },
            { id: "reason", type: "reasoning", text: "PRIVATE_REASONING" },
            {
              id: "tool",
              type: "mcpToolCall",
              tool: "fixture_lookup",
              arguments: { secret: "PRIVATE_ARGUMENT" },
              result: "PRIVATE_RESULT",
              status: "completed",
            },
            { id: "visible", type: "agentMessage", text: "Visible answer" },
          ],
        },
      ],
    });
    const response = await f.read({ limit: "2" });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain("PRIVATE_");
    expect(JSON.parse(body).items.map((item: JsonRecord) => item.text)).toEqual([
      "Tool call: fixture_lookup",
      "Visible answer",
    ]);
  });

  it.each([
    { appId: "foreign", taskId: "review/one", generation: 1 },
    { appId: "sample", taskId: "foreign", generation: 1 },
    { appId: "sample", taskId: "review/one", generation: 2 },
    { appId: "sample", taskId: "review/one", generation: 1, cwd: "../relative" },
  ])("rejects a binding with a different identity or invalid workspace: %j", async (binding) => {
    const f = fixture({ binding: { threadId: "foreign-thread", cwd: tmpdir(), ...binding } });
    const response = await f.read();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      session: null,
      items: [],
      unavailable: "No Codex transcript is bound to the current Task generation",
    });
    expect(f.peers).toHaveLength(0);
  });

  it("rejects caller native IDs, workspaces, excessive limits and invalid or tampered cursors before starting a reader", async () => {
    const f = fixture();
    for (const query of [
      { threadId: "foreign" },
      { cwd: "/foreign" },
      { limit: "101" },
      { limit: "0" },
      { limit: "1.5" },
      { cursor: "forged.cursor" },
    ]) {
      expect((await f.read(query)).status).toBe(400);
    }
    expect(f.peers).toHaveLength(0);
    const paging = fixture({
      turns: [
        {
          id: "turn",
          items: [
            { id: "one", type: "agentMessage", text: "One" },
            { id: "two", type: "agentMessage", text: "Two" },
          ],
        },
      ],
    });
    const first = await (await paging.read({ limit: "1" })).json();
    expect((await paging.read({ cursor: `${first.nextCursor.slice(0, -2)}aa` })).status).toBe(400);
    expect(paging.peers).toHaveLength(1);
  });

  it("rejects a cursor after the Task generation changes", async () => {
    const task = { appId: "sample", taskId: "review/one", generation: 1 };
    const f = fixture({
      task,
      turns: [
        {
          id: "turn",
          items: [
            { id: "one", type: "agentMessage", text: "One" },
            { id: "two", type: "agentMessage", text: "Two" },
          ],
        },
      ],
    });
    const first = await (await f.read({ limit: "1" })).json();
    task.generation = 2;
    const state = JSON.parse(readFileSync(f.stateFile, "utf8"));
    state.bindings[codexGoalBindingKey("sample", "review/one")].generation = 2;
    writeFileSync(f.stateFile, JSON.stringify(state));
    expect((await f.read({ cursor: first.nextCursor })).status).toBe(400);
    expect(f.peers).toHaveLength(1);
  });

  it("discards native bytes if the Task is reopened during the read", async () => {
    let reads = 0;
    const f = fixture({
      turns: [{ id: "turn", items: [{ id: "answer", type: "agentMessage", text: "OLD_GENERATION_BYTES" }] }],
      daemonRead: async () => ({
        type: "ok",
        task: { appId: "sample", taskId: "review/one", generation: ++reads === 1 ? 1 : 2 },
      }),
    });
    const response = await f.read();
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("OLD_GENERATION_BYTES");
    expect(f.peers[0].closed).toBe(true);
  });

  it("discards native bytes if the current Task binding is replaced during the read", async () => {
    const f = fixture({
      turns: [{ id: "turn", items: [{ id: "answer", type: "agentMessage", text: "REPLACED_THREAD_BYTES" }] }],
      processOptions: {
        onItems: () => {
          const state = JSON.parse(readFileSync(f.stateFile, "utf8"));
          state.bindings[codexGoalBindingKey("sample", "review/one")].threadId = "replacement-thread";
          writeFileSync(f.stateFile, JSON.stringify(state));
        },
      },
    });
    const response = await f.read();
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("REPLACED_THREAD_BYTES");
    expect(f.peers[0].closed).toBe(true);
  });

  it.each([
    { errorMethod: "initialize" },
    { errorMethod: "thread/read" },
    { errorMethod: "thread/items/list" },
    { threadId: "foreign-thread" },
    { invalidTurn: true },
    { repeatedCursor: true },
  ])(
    "reports native failure without exposing private diagnostics or leaving a reader running: %j",
    async (processOptions) => {
      const f = fixture({ processOptions, turns: [{ id: "turn", items: [{ id: "reason", type: "reasoning" }] }] });
      const response = await f.read();
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(body).toContain("Codex transcript could not be read");
      expect(body).not.toContain("PRIVATE_PROVIDER_DIAGNOSTIC");
      expect(f.peers[0].closed).toBe(true);
      expect(
        f.peers[0].writes.every(({ method }) =>
          ["initialize", "initialized", "thread/read", "thread/items/list"].includes(String(method)),
        ),
      ).toBe(true);
    },
  );

  it("bounds output and scanning hidden-only pages while retaining an older-history cursor", async () => {
    const large = fixture({
      turns: [
        {
          id: "turn",
          items: [
            {
              id: "command",
              type: "commandExecution",
              command: "x".repeat(10_000),
              aggregatedOutput: "y".repeat(30_000),
            },
            { id: "answer", type: "agentMessage", text: "a".repeat(40_000) },
          ],
        },
      ],
    });
    const body = await (await large.read()).json();
    expect(body.items[0].command.length).toBeLessThan(2_100);
    expect(body.items[0].text.length).toBeLessThan(4_100);
    expect(body.items[1].text.length).toBeLessThan(16_100);
    const hidden = fixture({
      turns: [
        { id: "turn", items: Array.from({ length: 40 }, (_, index) => ({ id: `reason-${index}`, type: "reasoning" })) },
      ],
    });
    const page = await (await hidden.read({ limit: "1" })).json();
    expect(page.items).toEqual([]);
    expect(typeof page.nextCursor).toBe("string");
    expect(hidden.peers[0].writes.filter(({ method }) => method === "thread/items/list")).toHaveLength(16);
  });

  it("returns precise missing, managed-session, daemon and malformed-binding states without native reads", async () => {
    const missing = fixture({ task: null });
    expect((await missing.read()).status).toBe(404);
    const managed = fixture({
      binding: null,
      task: { appId: "sample", taskId: "review/one", generation: 1, execution: { sessionId: "managed-one" } },
    });
    expect(await (await managed.read()).json()).toMatchObject({
      session: { id: "managed-one", kind: "may" },
      items: [],
      unavailable: "Managed-session transcripts are not available through this Task reader",
    });
    const daemon = fixture({ daemonRead: async () => ({ type: "error", message: "PRIVATE_STORAGE_DETAILS" }) });
    const daemonResponse = await daemon.read();
    expect(daemonResponse.status).toBe(503);
    expect(await daemonResponse.text()).not.toContain("PRIVATE_STORAGE_DETAILS");
    const wrongIdentity = fixture({ task: { appId: "foreign", taskId: "review/one", generation: 1 } });
    expect((await wrongIdentity.read()).status).toBe(503);
    const malformed = fixture();
    writeFileSync(malformed.stateFile, "not-json");
    expect((await malformed.read()).status).toBe(503);
    expect([
      ...missing.peers,
      ...managed.peers,
      ...daemon.peers,
      ...wrongIdentity.peers,
      ...malformed.peers,
    ]).toHaveLength(0);
  });

  it("filters generated goal messages across all retained generations on a reused thread", async () => {
    const taskId = "domain/kubernetes-version-support/1.38";
    const root = mkdtempSync(join(tmpdir(), "may-task-transcript-generations-"));
    roots.push(root);
    writeFileSync(
      join(root, "codex-goal-bindings.json"),
      JSON.stringify({
        version: 1,
        bindings: {
          [codexGoalBindingKey("sample", taskId)]: {
            appId: "sample",
            taskId,
            generation: 2,
            threadId: "thread-reused",
            cwd: root,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:01:00Z",
            attempts: 2,
            staleInterrupts: 0,
          },
        },
      }),
    );
    const turns: FixtureTurn[] = [
      {
        id: "turn-gen-1",
        items: [
          {
            id: "goal-gen-1",
            type: "userMessage",
            text: `Achieve May Task sample/${taskId} generation 1: Validate Kubernetes 1.38 initial rollout`,
          },
          { id: "user-1", type: "userMessage", text: "Check Linux node pools first." },
          { id: "assistant-1", type: "agentMessage", text: "Linux node pool checks completed." },
        ],
      },
      {
        id: "turn-gen-2",
        items: [
          {
            id: "goal-gen-2",
            type: "userMessage",
            text: `Achieve May Task sample/${taskId} generation 2: Include Windows version gates`,
          },
          { id: "assistant-2", type: "agentMessage", text: "Added Windows version gates." },
        ],
      },
    ];
    const handler = createTaskTranscriptHandler({
      stateDir: root,
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
      daemonRead: async () => ({
        type: "ok",
        task: { appId: "sample", taskId, generation: 2, status: "running" },
      }),
      createCodexClient: () => new CodexGoalAppServerClient(new TranscriptProcess(turns, { threadId: "thread-reused" })),
    });

    const response = await handler(
      new URL(`http://localhost/api/task/transcript?${new URLSearchParams({ appId: "sample", taskId })}`),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { role: string; text: string }) => ({ role: item.role, text: item.text }))).toEqual([
      { role: "user", text: "Check Linux node pools first." },
      { role: "assistant", text: "Linux node pool checks completed." },
      { role: "assistant", text: "Added Windows version gates." },
    ]);
  });
});
