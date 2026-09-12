import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../../lib/db-writer.js";
import { getDb, closeDb } from "../../lib/requests.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, EVENT_DELIVERY_RESULT, type AgentEvent } from "../core/events/bus.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { appTaskContext, readAppTaskAdmissionOutcome } from "../core/tasks/app-task-reconciler.js";
import { admitTaskRequest } from "../core/state/inbox.js";
import { applyConversationRequestUpdates, readConversationRequest } from "../core/state/conversation-requests.js";
import { finishTask } from "../../../test/fixtures/request-task-state.js";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Input did not recover");
    await Bun.sleep(5);
  }
}

for (const failure of ["mapping", "link-write", "report-write"] as const) {
  test(`retains input after ${failure} failure, admits unrelated work and repairs without an inbox worker`, async () => {
    const root = mkdtempSync(join(tmpdir(), "may-direct-input-"));
    const db = getDb(root);
    let broken = true;
    let now = Date.now();
    const app = defineApp({
      id: "example",
      version: 1,
      agent: "example-owner",
      inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
      tasks: {},
      task: ({ id }) => {
        if (broken && id === "first" && failure !== "link-write") throw new Error("mapping unavailable");
        return {
          kind: "desired",
          intent: { id, parentId: "root", outcome: "Answer", acceptance: ["Verified"] },
        };
      },
    });
    const store = AppTaskResourceStore.fromDb(db, app.id);
    store.bootstrapSnapshot(
      {
        project: app.id,
        root_task_id: "root",
        project_lifecycle: "active",
        groups: { root: { id: "root", parent_id: null } },
      },
      "fixture",
    );
    const config = appTaskContext({ appDir: root, projectDir: root, agent: app.agent!, resourceStore: store });
    const registry = new AppRegistry(async () => [{ appDir: root, definition: app }]);
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    const failures: AgentEvent[] = [];
    const diagnostic = spyOn(console, "error").mockImplementation(() => {});
    bus.setPersistenceSubscriber((event) => {
      if (event.type === "handler.failed") {
        failures.push(event);
        if (failure === "report-write") throw new Error("diagnostic storage unavailable");
      }
      return writer.handler(event);
    });
    bus.setDeliveryRecorder(writer.recordDelivery);
    if (failure === "link-write")
      db.exec(`CREATE TRIGGER fail_link BEFORE UPDATE ON app_inbox_items
      WHEN NEW.id = 'first' AND NEW.waiting_on_kind = 'task'
      BEGIN SELECT RAISE(ABORT, 'input link unavailable'); END`);
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      updateKey: "accepted",
      now,
      updates: [{ id: "ask", expectedRevision: 0, scope: "Compare the options", disposition: "open" }],
    });
    const accepted = readConversationRequest(db, app.id, "chat", "ask");
    const runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      deferStart: true,
      now: () => now,
      attachTask: (input) => admitTaskRequest(config, input),
      readDependency: async ({ dependency, admissionKey }) => {
        const outcome = admissionKey ? readAppTaskAdmissionOutcome(config, dependency.id, admissionKey) : null;
        return { ...dependency, status: outcome ? "done" : "pending", summary: outcome?.summary };
      },
    });
    const publish = (id: string) =>
      bus.emit({
        type: "app.input.requested",
        source: "fixture",
        owner: "app:example",
        data: { appId: app.id, requestId: id, input: { kind: "message", data: {} }, source: { kind: "human", id } },
      });
    try {
      expect(publish("first")[EVENT_DELIVERY_RESULT]).toMatchObject({ accepted: true });
      expect(runtime.host.get("first")?.status).toBe("pending");
      expect(store.readTask("first")).toBeNull();
      publish("unrelated");
      expect(runtime.host.get("unrelated")?.waitingOn?.id).toBe("unrelated");
      expect(failures).toHaveLength(1);
      expect(readConversationRequest(db, app.id, "chat", "ask")).toEqual(accepted);
      broken = false;
      if (failure === "link-write") db.exec("DROP TRIGGER fail_link");
      await runtime.start();
      await until(() => runtime.host.get("first")?.waitingOn?.kind === "task");
      finishTask(config, "first");
      finishTask(config, "unrelated");
      now += 60_001;
      runtime.scanNow();
      await until(
        () => runtime.host.get("first")?.status === "done" && runtime.host.get("unrelated")?.status === "done",
      );
      expect(runtime.host.get("first")?.result?.summary).toBe("Verified");
      expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE lease_owner IS NOT NULL").get()).toEqual({
        count: 0,
      });
      expect(readConversationRequest(db, app.id, "chat", "ask")).toEqual(accepted);
    } finally {
      runtime.close();
      diagnostic.mockRestore();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
}
