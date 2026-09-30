import { afterEach, expect, it, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { AppRegistry } from "../core/apps/registry.js";
import { discoverAppDefinitions } from "../adapters/discovery/app-definitions.js";
import { EventBus } from "../core/events/bus.js";
import { admitConversationTaskInput, conversationTaskIntent } from "../core/state/conversation-task-turns.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { admitTaskInput } from "../core/state/inbox.js";
import { appTaskTestContext } from "../core/tasks/app-task-test-support.js";
import { appTaskContext, cancelAppTask, observeAppTaskIntent } from "../core/tasks/app-task-reconciler.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 2_000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Review input was not admitted");
    await Bun.sleep(5);
  }
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

it("durably routes an orphan admission rejection to App conversation once despite a lost marker and restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-admission-review-"));
  const appDir = join(root, "sample.app");
  mkdirSync(appDir);
  let runtime: AppInboxRuntime | undefined;
  cleanup.push(() => {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(
    join(appDir, "app.js"),
    `export default {
    id: "sample", version: 1, owner: "owner", inputSchema: { type: "object" }, tasks: {},
    task() { return { kind: "existing", taskId: "work" }; },
    conversation: { mode: "agent", inputKinds: ["message"], conversationId: "sample:primary" },
    subscriptions: [{ id: "admission-review", event: { type: "app.input.admission.failed", target: { appId: "sample" } },
      toInput(event) { return { kind: "message", data: { message: "Review rejection", failure: event.data } }; } }]
  };`,
  );
  let db = getDb(root);
  let config = appTaskTestContext({
    appDir,
    agent: "owner",
    maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.fromDb(db, "sample"),
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    intent: { id: "work", parentId: "root", outcome: "Measure", acceptance: ["Value recorded"] },
  });
  const task = config.resourceStore.readTask("work")!;
  cancelAppTask(config, {
    appId: "sample",
    taskId: "work",
    expectedGeneration: task.metadata.generation,
    expectedResourceVersion: task.metadata.resourceVersion,
    reason: "Owner ended task",
  });
  const registry = new AppRegistry(discoverAppDefinitions(root));
  await registry.reload();
  let now = Date.now();
  const start = async () => {
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      now: () => now,
      schedulesEnabled: false,
      deferStart: true,
      attachTask: (input) => admitTaskInput(config, input),
      admitConversation: (input) =>
        admitConversationTaskInput(config, {
          ...input,
          intent: conversationTaskIntent(config),
          conversationInputKinds: ["message"],
        }),
    });
  };
  await start();
  const prepare = db.prepare.bind(db);
  let loseMarker = true;
  const marker = spyOn(db, "prepare").mockImplementation((sql) => {
    if (loseMarker && sql.includes("SET recovery_json = ?, changed_at = ?, updated_at = ?")) {
      loseMarker = false;
      throw new Error("Notification committed before reported marker");
    }
    return prepare(sql);
  });
  runtime!.host.admit({
    id: "late-input",
    appId: "sample",
    targetTaskId: "work",
    source: { kind: "system", id: "operator" },
    input: { kind: "probe", data: {} },
  });
  marker.mockRestore();
  expect(runtime!.host.get("late-input")).toMatchObject({ status: "done", handling: { phase: "failed" } });
  expect(runtime!.host.get("late-input")?.recovery?.["input-admission"]?.reportedAt).toBeUndefined();
  await waitFor(
    () =>
      db
        .prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE conversation_id = 'sample:primary'")
        .get()!.count === 1,
  );
  runtime!.close();
  closeDb(root);
  db = getDb(root);
  config = appTaskContext({
    appDir,
    projectDir: appDir,
    agent: "owner",
    resourceStore: AppTaskResourceStore.fromDb(db, "sample"),
  });
  now += 60_000;
  await start();
  await runtime!.host.recoverAdmissions();
  expect(runtime!.host.get("late-input")?.recovery?.["input-admission"]?.reportedAt).toBe(now);
  expect(
    db
      .prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE conversation_id = 'sample:primary'")
      .get()!.count,
  ).toBe(1);
  expect(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'app.input.admission.failed'").get()!
      .count,
  ).toBe(1);
  expect(config.resourceStore.isCancelled("work")).toBe(true);
});
