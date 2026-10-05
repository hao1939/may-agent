import { applyDbSchema } from "../../lib/db/schema.js";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp } from "@may-agent/sdk";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, type AgentEvent } from "../core/events/bus.js";
import { AppInboxHost } from "../core/inbox/app-inbox-host.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { admitTaskInput } from "../core/state/inbox.js";
import { createAppTaskCapability } from "../core/tasks/app-task-capability.js";
import { appTaskTestContext } from "../core/tasks/app-task-test-support.js";
import { cancelAppTask, claimObservedAppTask, completeAppTask } from "../core/tasks/app-task-reconciler.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";

test("restart returns retained answers and cancellations to exact callers after the App is removed", async () => {
  const root = mkdtempSync(join(tmpdir(), "retained-task-results-"));
  const path = join(root, "host.sqlite");
  const config = appTaskTestContext({
    appDir: root, agent: "owner", maxConcurrent: 1, databasePath: path,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  let store = config.resourceStore;
  applyDbSchema(store.db);
  let runtime: Awaited<ReturnType<typeof startAppInboxRuntime>> | undefined;
  const app = defineApp({
    id: "sample", agent: "owner", version: 1,
    inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Unknown() }),
    tasks: {},
    task: (input) => ({ kind: "desired", intent: { id: input.id === "pending" ? "pending" : "work", parentId: "root", outcome: "Handle requests", acceptance: ["Answer each ask"] } }),
  });
  const host = new AppInboxHost({
    db: store.db, apps: [app],
    attachTask: (input) => ({ taskId: admitTaskInput(config, input).taskId }),
    readDependency: async () => null,
    now: () => 1000,
  });
  try {
    const admit = (id: string) => host.admit({
      id, appId: "sample", source: { kind: "app", id: "caller" },
      input: { kind: "message", data: { text: id } },
    });
    admit("answered");
    const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (claim.kind !== "claimed") throw new Error("Missing attempt");
    completeAppTask(config, claim, { summary: "Original ask fulfilled", result: { value: 42 } });
    admit("withdrawn-one");
    admit("withdrawn-two");
    const task = store.readTask("work")!;
    cancelAppTask(config, {
      appId: "sample", taskId: "work", expectedGeneration: task.metadata.generation,
      expectedResourceVersion: task.metadata.resourceVersion,
      decision: "human", reason: "Withdraw remaining asks as unfulfilled",
    });
    await host.refreshTaskResults("sample", "work");
    expect(host.get("withdrawn-one")?.recovery?.["input-result"]?.error).toBe("Task dependency evidence is unavailable");
    admit("pending");
    host.close();
    store.close();

    // Fresh database handle and no executable App definition or Task runtime.
    store = AppTaskResourceStore.openStandalone(path, "sample");
    const bus = new EventBus();
    const returned: AgentEvent[] = [];
    bus.subscribe((event) => { if (event.type === "app.dependency.updated") returned.push(event); });
    const registry = new AppRegistry(async () => []);
    await registry.reload();
    const capability = createAppTaskCapability({ bus, db: store.db });
    runtime = await startAppInboxRuntime({
      db: store.db, bus, registry, persistDir: root, schedulesEnabled: false,
      readDependency: capability.readDependency,
    });
    await runtime.host.recoverTaskResults();
    expect(runtime.host.get("answered")).toMatchObject({
      status: "done", result: { summary: "Original ask fulfilled", result: { value: 42 } },
    });
    for (const id of ["withdrawn-one", "withdrawn-two"]) {
      expect(runtime.host.get(id)).toMatchObject({
        status: "done", waitingOn: { kind: "task", id: "work" },
        source: { kind: "app", id: "caller" },
        result: { summary: "The Task closed without an accepted outcome for this input" },
        recovery: { "input-result": { recoveredAt: expect.any(Number) } },
      });
      expect(runtime.host.get(id)?.result?.result).toBeUndefined();
      expect(runtime.host.get(id)?.result?.facts).toEqual(store.readCancellation("work")!.facts);
    }
    await runtime.host.refreshTaskResults("sample", "work");
    await runtime.host.recoverTaskResults();
    expect(runtime.host.get("pending")).toMatchObject({ status: "handling" });
    expect(runtime.host.get("pending")?.recovery).toBeUndefined();
    expect(returned).toHaveLength(3);
    expect(new Set(returned.map((event) => (event.data as { idempotencyKey: string }).idempotencyKey)).size).toBe(3);
    expect(await capability.readDependency({ appId: "sample", dependency: { kind: "task", id: "work" }, admissionKey: "wrong-input" })).toBeNull();
    expect(await capability.readDependency({ appId: "absent", dependency: { kind: "task", id: "work" }, admissionKey: "wrong-input" })).toBeNull();
    expect(AppTaskResourceStore.activeFromDb(store.db, "absent")).toBeNull();
    expect(registry.snapshot().entries).toHaveLength(0);
  } finally {
    host.close();
    runtime?.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
