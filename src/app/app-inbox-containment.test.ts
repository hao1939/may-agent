import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../lib/db-writer.js";
import { getDb, closeDb } from "../lib/requests.js";
import { AppRegistry } from "./core/apps/registry.js";
import { EventBus, type AgentEvent } from "./core/events/bus.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";
import { HostCapacity } from "./host-capacity.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversations/requests.js";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Runtime did not recover progress");
    await Bun.sleep(5);
  }
}

for (const mode of ["ready-read", "cleanup-read", "dependency-read", "report-write", "dispatch"] as const) {
  test(`contains ${mode} failure and preserves subsequent work and accepted asks`, async () => {
    const root = mkdtempSync(join(tmpdir(), "may-inbox-containment-"));
    const db = getDb(root);
    const app = defineApp({
      id: "sample",
      version: 1,
      agent: "sample-worker",
      inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
      requests: { mode: "agent" },
    });
    const registry = new AppRegistry(async () => [{ appDir: root, definition: app }]);
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    const failures: AgentEvent[] = [];
    let armed = false;
    let injected = 0;
    let reportingWrites = 0;
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "handler.failed") {
        failures.push(event);
        if (mode === "report-write") {
          reportingWrites++;
          throw new Error("diagnostic store unavailable");
        }
      }
      return writer.handler(event);
    });
    bus.setDeliveryRecorder(writer.recordDelivery);
    const prepare = db.prepare.bind(db);
    const query = spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (
        armed &&
        injected === 0 &&
        (((mode === "ready-read" || mode === "cleanup-read") && sql.includes("SELECT 1 AS ready FROM")) ||
          (mode === "dependency-read" && sql.includes("INDEXED BY idx_app_inbox_task_wait_recovery")))
      ) {
        injected++;
        throw new Error(`injected ${mode}`);
      }
      return prepare(sql);
    });
    const diagnostic = spyOn(console, "error").mockImplementation(() => {});
    const capacity = new HostCapacity(1);
    const run = capacity.run.bind(capacity);
    const dispatch = spyOn(capacity, "run").mockImplementation((work) => {
      if (mode === "dispatch" && injected++ === 0) throw new Error("injected dispatch");
      return run(work);
    });
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      updateKey: "accepted",
      now: 1,
      updates: [{ id: "ask", expectedRevision: 0, scope: "Compare the options", disposition: "open" }],
    });
    const accepted = readConversationRequest(db, app.id, "chat", "ask");
    const calls: string[] = [];
    const runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      hostCapacity: capacity,
      maxConcurrentRequests: 1,
      // Admissions can share a timestamp; independent Conversations have no
      // cross-Conversation FIFO promise, even with one execution slot.
      now: () => 1_000,
      scanIntervalMs: 50,
      deferStart: true,
      readDependency: async () => null,
      resolveRequest: async ({ request }) => {
        calls.push(request.id);
        if (mode === "cleanup-read") armed = true;
        if (mode === "report-write" && request.id === "first") {
          await runtime.reload(undefined, async () => [{ appDir: root, definition: { ...app, agent: "replacement-worker" } }]);
          throw new Error("model failed once");
        }
        return { summary: "Answered", response: "Answer", topic: { kind: "none" } };
      },
    });
    const admit = (id: string, conversationId: string, sequence: number) =>
      runtime.host.admit({
        id,
        appId: app.id,
        conversationId,
        conversationSequence: sequence,
        source: { kind: "human", id },
        input: { kind: "message", data: {} },
      });
    try {
      admit("first", "chat", 1);
      armed = mode !== "cleanup-read";
      await runtime.start();
      await until(() => runtime.host.get("first")?.status === "done" && capacity.snapshot().running === 0);
      admit("correction", "chat", 2);
      admit("unrelated", "other", 1);
      runtime.scanNow();
      await until(
        () => runtime.host.get("correction")?.status === "done" && runtime.host.get("unrelated")?.status === "done",
      );
      expect(calls[0]).toBe("first");
      expect([...calls].sort()).toEqual(["correction", "first", "unrelated"]);
      expect(readConversationRequest(db, app.id, "chat", "ask")).toEqual(accepted);
      expect(failures.length).toBeGreaterThan(0);
      if (mode === "report-write") {
        expect(reportingWrites).toBe(1);
        expect(diagnostic.mock.calls.flat().join(" ")).toContain("model failed once");
        expect(runtime.host.get("first")?.handling?.phase).toBe("failed");
        expect(failures[0]).toMatchObject({
          type: "handler.failed",
          source: "app-inbox",
          owner: "app:sample",
          data: {
            appId: "sample",
            agent: "sample-worker",
            requestId: "first",
            conversationId: "chat",
            claimRevision: 1,
            stage: "input-handling",
            error: "model failed once",
            disposition: "failed",
          },
        });
      } else {
        expect(injected).toBeGreaterThan(0);
        expect(failures[0]).toMatchObject({ data: { disposition: "recovery-pending" } });
      }
      await until(() => capacity.snapshot().running === 0);
      expect(capacity.snapshot().waiting).toBe(0);
    } finally {
      runtime.close();
      query.mockRestore();
      dispatch.mockRestore();
      diagnostic.mockRestore();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
}
