import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { attachControlSocket, type AttachControlSocketOptions, type ControlSocket } from "../../packages/control/src/server.js";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { createEventInterface, type EventInterface } from "../../src/app/core/events/interface.js";
import { openStateDb, type SqliteDb } from "../../src/app/http/read-model/state-db.js";
import { closeDb } from "../../src/lib/db/connection.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";

type AdmittedInput = Parameters<NonNullable<AttachControlSocketOptions["admitAppInput"]>>[0];

describe("HTTP Task transcript and feedback transport", () => {
  const identity = { appId: "example", taskId: "support/version", generation: 3 };
  const draft = { ...identity, expectedGeneration: 3, message: "Include Windows version gates.", idempotencyKey: "feedback-1" };
  let root: string;
  let base: string;
  let db: SqliteDb;
  let control: ControlSocket;
  let child: ChildProcess | undefined;
  let stopped: Promise<void> | undefined;
  let task: Record<string, unknown> | null;
  let reads: unknown[];
  let admitted: AdmittedInput[];
  let publishedControls: Array<{ type: string; data: Record<string, unknown>; idempotencyKey?: string }>;
  let rejectRead: boolean;
  let rejectInput: boolean;
  let persistInput: boolean;
  let failDurableRoute: boolean;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "may-http-task-session-"));
    db = openStateDb(join(root, "may.db"));
    mkdirSync(join(root, "projects"), { recursive: true });
    const emptyPath = join(root, "empty-bin");
    mkdirSync(emptyPath);
    task = { ...identity, status: "running", terminal: false };
    reads = [];
    admitted = [];
    publishedControls = [];
    rejectRead = false;
    rejectInput = false;
    persistInput = false;
    failDurableRoute = false;
    child = undefined;
    stopped = undefined;
    let events: EventInterface | undefined;
    control = await attachControlSocket({
      socketPath: daemonSocketPath(root, { instance: "task-session-test", interfaceAgent: "helper" }),
      agentName: "helper",
      instance: "task-session-test",
      conversationAppId: identity.appId,
      getStatus: () => [],
      emitEvent: () => {},
      subscribeEvents: () => () => {},
      publishEvent: (event) => {
        publishedControls.push(event);
        return { eventId: 999, eventType: event.type, delivery: "accepted" };
      },
      getTask: (input) => {
        reads.push(input);
        if (rejectRead) throw new Error("fixture Task read unavailable");
        return task;
      },
      admitAppInput: (input) => {
        if (rejectInput) throw new Error("fixture App does not accept this input kind");
        admitted.push(input);
        if (persistInput) {
          if (!events) {
            const bus = new EventBus();
            const writer = new DbWriter(root);
            bus.setPersistenceSubscriber(writer.handler);
            bus.setDeliveryRecorder(writer.recordDelivery);
            bus.subscribeDurableRoute(() => {
              if (failDurableRoute) throw new Error("fixture durable inbox route failed");
              return { accepted: true, by: "fixture-admission", route: "direct" };
            });
            events = createEventInterface({
              bus,
              db,
              validateAppInput: () => {},
              hasApp: (appId) => appId === identity.appId,
              hasAgent: () => false,
              hasSession: () => false,
            });
          }
          const receipt = events.publish({
            type: "app.input.requested",
            target: { appId: input.appId },
            idempotencyKey: input.idempotencyKey,
            data: { input: input.input, targetTaskId: input.targetTaskId, channel: input.channel },
          }, {
            source: "control-socket",
            inputSource: { kind: "human", id: String(input.source.id) },
          });
          return receipt.delivery === "accepted" ? { ...receipt, requestId: `input-${receipt.eventId}` } : receipt;
        }
        return { eventId: 101, eventType: "app.input.requested", requestId: "input-101" };
      },
    });
    // Explicit fixture environment has no provider credentials, and its empty
    // PATH prevents a regression from launching a real native agent CLI.
    child = spawnFixtureProcess(
      [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"],
      {
        cwd: root,
        env: {
          PATH: emptyPath,
          PROJECT_ROOT: root,
          AGENTS_ROOT: root,
          SHARED_ROOT: root,
          PROJECTS_ROOT: join(root, "projects"),
          DAEMON_INSTANCE: "task-session-test",
          AGENT: "helper",
        },
      },
    );
    stopped = new Promise((done) => child!.once("close", () => done()));
    let logs = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      base = await new Promise<string>((ready, reject) => {
        timer = setTimeout(() => reject(new Error(`HTTP startup timed out: ${logs}`)), 10_000);
        child!.once("error", reject);
        child!.once("exit", (code) => reject(new Error(`HTTP exited (${code}): ${logs}`)));
        child!.stderr!.on("data", (chunk) => { logs += chunk.toString(); });
        child!.stdout!.on("data", (chunk) => {
          logs += chunk.toString();
          const port = logs.match(/url:\s+http:\/\/localhost:(\d+)/)?.[1];
          if (port) ready(`http://127.0.0.1:${port}`);
        });
      });
    } finally {
      clearTimeout(timer);
    }
  });

  afterEach(async () => {
    child?.kill("SIGKILL");
    await stopped;
    control?.close();
    db?.close();
    if (root) closeDb(root);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  async function send(body: Record<string, unknown> = draft, headers: Record<string, string> = {}) {
    return fetch(`${base}/api/task/input`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  }

  test("admits feedback through the socket with exact Task scope and server-owned attribution", async () => {
    const response = await send({
      ...draft,
      appId: " example ",
      taskId: " support/version ",
      message: ` ${draft.message} `,
      source: { kind: "app", id: "forged-source" },
      targetTaskId: "foreign-task",
      threadId: "foreign-native-thread",
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      accepted: true, ...identity, eventId: 101, inboxId: "input-101",
    });
    expect(reads).toEqual([{ appId: identity.appId, taskId: identity.taskId }]);
    expect(admitted).toEqual([{
      appId: identity.appId,
      targetTaskId: identity.taskId,
      input: {
        kind: "message",
        data: {
          message: draft.message,
          context: { intent: "task-feedback", taskId: identity.taskId, expectedGeneration: 3 },
        },
      },
      source: { kind: "human", id: "web-task:feedback-1" },
      channel: "web-ui",
      idempotencyKey: "web-task:7:example:15:support/version:feedback-1",
    }]);
    // A client retry crosses HTTP/socket again with the same admission identity.
    expect((await send()).status).toBe(202);
    expect(admitted[1]).toEqual(admitted[0]);
  });

  test("passes the App input kind and surfaces its rejection without direct session steering", async () => {
    expect((await send({ ...draft, inputKind: "owner-review" })).status).toBe(202);
    expect(admitted[0].input).toMatchObject({ kind: "owner-review", data: { message: draft.message } });
    rejectInput = true;
    const response = await send({ ...draft, inputKind: "unsupported", idempotencyKey: "feedback-2" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ delivery: "rejected" });
    expect(admitted).toHaveLength(1);
  });

  test("confirms the original durable feedback after the Task changes generation and closes", async () => {
    persistInput = true;
    const first = await send();
    expect(first.status).toBe(202);
    const original = await first.json();
    expect(original).toMatchObject({ accepted: true, ...identity });
    expect(Number.isSafeInteger(original.eventId)).toBe(true);
    expect(original.eventId).toBeGreaterThan(0);

    task = { ...identity, generation: 4, status: "closed", terminal: true };
    // Durable confirmation must succeed even if current Task reads now fail.
    rejectRead = true;
    const replay = await send();
    expect(replay.status).toBe(202);
    expect(await replay.json()).toMatchObject({
      accepted: true, ...identity, eventId: original.eventId, replayed: true,
    });
    expect(reads).toHaveLength(1);
    expect(admitted).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?").get("app.input.requested"))
      .toEqual({ count: 1 });

    // A reused key with changed text cannot borrow the previous publication.
    rejectRead = false;
    const changed = await send({ ...draft, message: "Different requested work." });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ generation: 4 });
    expect(admitted).toHaveLength(1);
  });

  test("rejects stale generation, foreign identity, closed and missing Tasks before admission", async () => {
    for (const [current, expected] of [
      [{ ...identity, generation: 4, terminal: false }, 409],
      [{ ...identity, taskId: "foreign-task", terminal: false }, 409],
      [{ ...identity, status: "closed", terminal: true }, 409],
      [null, 404],
    ] as const) {
      task = current;
      const response = await send();
      expect(response.status).toBe(expected);
      expect((await response.json()).accepted).toBeUndefined();
    }
    expect(admitted).toHaveLength(0);
    expect(reads).toHaveLength(4);
  });

  test("resolves transcript identity through the daemon without launching an unbound native reader", async () => {
    const query = new URLSearchParams({ appId: identity.appId, taskId: identity.taskId });
    task = null;
    const missing = await fetch(`${base}/api/task/transcript?${query}`, { signal: AbortSignal.timeout(5_000) });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Task not found" });
    task = { ...identity, status: "running", terminal: false };
    const unbound = await fetch(`${base}/api/task/transcript?${query}`, { signal: AbortSignal.timeout(5_000) });
    expect(unbound.status).toBe(200);
    expect(await unbound.json()).toMatchObject({
      ...identity, items: [], session: null, unavailable: "No Codex transcript is bound to the current Task generation",
    });
    expect(reads).toEqual([
      { appId: identity.appId, taskId: identity.taskId },
      { appId: identity.appId, taskId: identity.taskId },
    ]);
    expect(admitted).toHaveLength(0);
  });

  test("method and origin guards run before daemon reads or input admission", async () => {
    for (const [path, method] of [
      ["/api/task/input", "GET"],
      ["/api/task/input", "PUT"],
      ["/api/task/transcript", "POST"],
      ["/api/task/transcript", "DELETE"],
    ]) {
      const response = await fetch(base + path, { method, signal: AbortSignal.timeout(5_000) });
      expect(response.status).toBe(405);
    }
    expect((await send(draft, { origin: "https://foreign.test" })).status).toBe(403);
    expect(reads).toHaveLength(0);
    expect(admitted).toHaveLength(0);
  });

  test("unavailable daemon reads cannot claim transcript availability or accepted input", async () => {
    rejectRead = true;
    const query = new URLSearchParams({ appId: identity.appId, taskId: identity.taskId });
    const transcript = await fetch(`${base}/api/task/transcript?${query}`, { signal: AbortSignal.timeout(5_000) });
    expect(transcript.status).toBe(503);
    expect(await transcript.json()).toEqual({ error: "Current Task could not be read" });
    const feedback = await send();
    expect(feedback.status).toBe(503);
    expect((await feedback.json()).accepted).toBeUndefined();
    expect(admitted).toHaveLength(0);
  });

  test("routes /reload and /restart as Task feedback on the configured conversation App without triggering runtime controls", async () => {
    for (const [index, commandText] of ["/reload", "/restart"].entries()) {
      const response = await send({ ...draft, message: commandText, idempotencyKey: `cmd-feedback-${index}` });
      expect(response.status).toBe(202);
      expect(await response.json()).toMatchObject({
        accepted: true,
        ...identity,
        eventId: 101,
        inboxId: "input-101",
      });
    }
    expect(publishedControls).toEqual([]);
    expect(admitted.map((entry) => ({
      targetTaskId: entry.targetTaskId,
      message: (entry.input.data as Record<string, unknown>).message,
    }))).toEqual([
      { targetTaskId: identity.taskId, message: "/reload" },
      { targetTaskId: identity.taskId, message: "/restart" },
    ]);
  });

  test("does not confirm persisted-but-failed delivery and admits colon-separated Task IDs without key collisions", async () => {
    persistInput = true;
    failDurableRoute = true;

    const first = await send();
    expect(first.status).toBe(503);
    const firstBody = await first.json();
    expect(firstBody.accepted).toBeUndefined();
    expect(firstBody).toMatchObject({ delivery: "recorded" });
    expect(Number.isSafeInteger(firstBody.eventId)).toBe(true);

    // Persisted failed delivery must not satisfy confirmation on retry; daemon admission must run again.
    const stillFailing = await send();
    expect(stillFailing.status).toBe(503);
    expect(admitted).toHaveLength(2);

    failDurableRoute = false;
    const recovered = await send();
    expect(recovered.status).toBe(202);
    expect(await recovered.json()).toMatchObject({
      accepted: true,
      ...identity,
      eventId: firstBody.eventId,
    });
    expect(admitted).toHaveLength(3);

    // Colon-containing Task IDs and retry keys in the same App must not collide in DbWriter.
    task = { appId: identity.appId, taskId: "support:version", generation: 1, status: "running", terminal: false };
    const colonTask = await send({
      appId: identity.appId,
      taskId: "support:version",
      expectedGeneration: 1,
      message: "For support:version",
      idempotencyKey: "feedback-1",
    });
    expect(colonTask.status).toBe(202);
    const colonBody = await colonTask.json();

    task = { appId: identity.appId, taskId: "support", generation: 1, status: "running", terminal: false };
    const plainTask = await send({
      appId: identity.appId,
      taskId: "support",
      expectedGeneration: 1,
      message: "For support",
      idempotencyKey: "version:feedback-1",
    });
    expect(plainTask.status).toBe(202);
    const plainBody = await plainTask.json();
    expect(plainBody.eventId).not.toBe(colonBody.eventId);
  });
});
