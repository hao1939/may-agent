import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAppDefinitions } from "../../src/app/adapters/discovery/app-definitions.js";
import { createAppInputAdmission } from "../../src/app/app-runtime.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { EVENT_ROW_ID, EventBus, type AgentEvent } from "../../src/app/core/events/bus.js";
import { createEventInterface, findEventPublication } from "../../src/app/core/events/interface.js";
import { createAppInboxItem } from "../../src/app/core/state/app-inbox-store.js";
import { createAppTaskEvents } from "../../src/app/core/tasks/app-task-emitter.js";
import { createAppTaskCapability } from "../../src/app/core/tasks/app-task-capability.js";
import { appTaskContext, observeAppTaskIntent } from "../../src/app/core/tasks/app-task-reconciler.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../../src/app/core/tasks/app-task-runtime.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

test("public targeted input retains its receipt, attaches once and reaches only its live Task", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-input-feedback-"));
  const persistDir = join(root, "state");
  mkdirSync(join(root, "sample.app/tasks"), { recursive: true });
  writeFileSync(join(root, "sample.app/tasks/seed.json"), JSON.stringify({
    root_task_id: "root", groups: { root: { id: "root", parent_id: null } },
  }));
  writeFileSync(
    join(root, "sample.app/app.js"),
    `export default {
    id: "sample", version: 1, agent: "owner", tasks: {},
    inputSchema: { type: "object", required: ["kind", "data"], properties: {
      kind: { const: "message" }, data: { type: "object" }
    } },
    conversation: { mode: "task", inputKinds: ["message"], conversationId: "primary" },
    task() { throw new Error("An exact Task address must bypass mapping"); }
  };`,
  );
  const bus = new EventBus();
  const db = getDb(persistDir);
  const writer = new DbWriter(persistDir);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const registry = new AppRegistry(discoverAppDefinitions(root));
  await registry.reload();
  const startGate = Promise.withResolvers<void>();
  await installAppTaskRuntimes({
    projectRoot: root, projectsRoot: root, persistDir, bus,
    appRegistrySnapshot: registry.snapshot(), startAfter: startGate.promise,
  }, { deferRecovery: true });
  const config = appTaskContext({
    appDir: join(root, "sample.app"), projectDir: join(root, "sample.app"), agent: "owner", maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.activeFromDb(db, "sample")!,
  });
  for (const id of ["current", "other"]) observeAppTaskIntent(config, {
    appAgent: "owner", intent: { id, parentId: "root", outcome: "Handle feedback", acceptance: ["Feedback applied"] },
  });
  const capability = createAppTaskCapability({ bus });
  const attached: string[] = [];
  let conversations = 0;
  const runtime = await startAppInboxRuntime({
    registry,
    db,
    bus,
    scanIntervalMs: 60_000,
    attachTask: (input) => {
      if (input.attachment.kind !== "existing") throw new Error("Expected existing Task");
      attached.push(input.attachment.taskId);
      return capability.attach(input);
    },
    admitTaskEvent: capability.admitEvent,
    hasTaskTarget: capability.has,
    previewTaskEvent: capability.previewEvent,
    previewTaskEventRoutes: capability.previewEventRoutes,
    admitConversation: (input) => {
      conversations++;
      return createAppInboxItem(db, input);
    },
  });
  const events = createEventInterface({
    bus,
    db,
    hasApp: (id) => runtime.host.hasApp(id),
    validateAppInput: (id, input) => runtime.host.assertAcceptsInput(id, input),
  });
  const admit = createAppInputAdmission({ events });
  const seen: AgentEvent[] = [];
  const other: AgentEvent[] = [];
  const notified = Promise.withResolvers<void>();
  const stops = ["current", "other"].map((taskId) =>
    createAppTaskEvents({
      bus,
      db,
      appId: "sample",
      claim: { taskId, generation: 1, attemptId: `attempt-${taskId}`, agent: "owner" },
    }).onEvent((event) => {
      if (taskId === "current") {
        seen.push(event);
        notified.resolve();
      } else other.push(event);
    }),
  );
  try {
    const command = {
      appId: "sample",
      targetTaskId: "current",
      idempotencyKey: "correction-1",
      source: { kind: "human" as const, id: "operator" },
      input: { kind: "message", data: { text: "Preserve the earlier evidence" } },
    };
    const receipt = admit(command);
    await notified.promise;
    expect(admit(command)).toEqual(receipt);
    expect(attached).toEqual(["current"]);
    expect(conversations).toBe(0);
    expect(seen).toHaveLength(1);
    expect(other).toEqual([]);
    expect(seen[0]!.type).toBe("app.task.requested");
    expect(Number(seen[0]![EVENT_ROW_ID])).toBeGreaterThan(receipt.eventId);
    const admissionKey = runtime.host.get(String((seen[0]!.data.request as { id: string }).id))!.taskAdmissionKey;
    expect(seen[0]!.data.idempotencyKey).toBe(admissionKey);
    expect(seen[0]!.target).toEqual({ project: "sample", taskId: "current" });
    const view = events.get(receipt.eventId)!;
    expect(view.event.target).toEqual({ appId: "sample" }); // No rewritten envelope.
    expect(view.event.data.targetTaskId).toBe("current");
    expect(
      findEventPublication(
        db,
        {
          type: "app.input.requested",
          target: { appId: "sample" },
          idempotencyKey: command.idempotencyKey,
          data: { input: command.input, targetTaskId: "current" },
        },
        { source: "control-socket", inputSource: command.source },
      ),
    ).toBe(receipt.eventId);
    expect(db.prepare("SELECT status, target_task_id, waiting_on_id FROM app_inbox_items").all()).toEqual([
      { status: "handling", target_task_id: "current", waiting_on_id: "current" },
    ]);
    // Seeing a hint does not complete its input or reroute a normal message.
    admit({ ...command, targetTaskId: undefined, idempotencyKey: "ordinary-message" });
    expect(conversations).toBe(1);
    expect(() =>
      events.publish(
        {
          type: "app.input.requested",
          target: { appId: "sample", taskId: "other" },
          data: { input: command.input, targetTaskId: "current" },
        },
        { source: "test" },
      ),
    ).toThrow("conflicts");
    expect(() => admit({ ...command, input: { kind: "invalid", data: {} } })).toThrow(
      'Invalid input for App sample at /kind: must be equal to constant {"allowedValue":"message"}',
    );
  } finally {
    stops.forEach((stop) => stop());
    runtime.close();
    const drained = closeInstalledAppTaskRuntimes(bus);
    startGate.resolve();
    await drained;
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 10_000);

test("conversation.message.created stays in Conversation and preserves focusedTask/taskReply context without hijacking target_task_id", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-conversation-only-"));
  const persistDir = join(root, "state");
  mkdirSync(join(root, "may.app/tasks"), { recursive: true });
  writeFileSync(
    join(root, "may.app/tasks/seed.json"),
    JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
  );
  writeFileSync(
    join(root, "may.app/app.js"),
    `export default {
      id: "may", version: 1, agent: "may", tasks: {},
      inputSchema: { type: "object", required: ["kind", "data"], properties: {
        kind: { const: "message" }, data: { type: "object" }
      } },
      conversation: { mode: "task", inputKinds: ["message"], conversationId: "may:primary" },
      task() { throw new Error("Conversation messages must not bypass into App task()"); }
    };`,
  );
  const bus = new EventBus();
  const db = getDb(persistDir);
  const writer = new DbWriter(persistDir);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const registry = new AppRegistry(discoverAppDefinitions(root));
  await registry.reload();
  const gate = Promise.withResolvers<void>();
  await installAppTaskRuntimes(
    { projectRoot: root, projectsRoot: root, persistDir, bus, appRegistrySnapshot: registry.snapshot(), startAfter: gate.promise },
    { deferRecovery: true },
  );
  const config = appTaskContext({
    appDir: join(root, "may.app"),
    projectDir: join(root, "may.app"),
    agent: "may",
    maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.activeFromDb(db, "may")!,
  });
  observeAppTaskIntent(config, {
    appAgent: "may",
    intent: { id: "bg-work", parentId: "root", outcome: "Background task", acceptance: ["Done"] },
  });
  const capability = createAppTaskCapability({ bus, db });
  const runtime = await startAppInboxRuntime({
    registry,
    db,
    bus,
    scanIntervalMs: 60_000,
    attachTask: capability.attach,
    admitConversation: capability.admitConversation,
    admitTaskEvent: capability.admitEvent,
    hasTaskTarget: capability.has,
    previewTaskEvent: capability.previewEvent,
    previewTaskEventRoutes: capability.previewEventRoutes,
  });
  const events = createEventInterface({
    bus,
    db,
    hasApp: (id) => runtime.host.hasApp(id),
    validateAppInput: (id, input) => runtime.host.assertAcceptsInput(id, input),
  });
  try {
    events.publish(
      {
        type: "conversation.message.created",
        target: { appId: "may" },
        idempotencyKey: "conv-with-focus",
        data: {
          conversationId: "may:primary",
          author: { kind: "human", id: "user-1" },
          text: "How is bg-work going?",
          taskReply: { target: { appId: "may", taskId: "bg-work" }, taskGeneration: 1 },
          context: { focusedTask: { appId: "may", taskId: "bg-work" } },
        },
      },
      { source: "control-socket" },
    );
    const row = db
      .prepare("SELECT app_id, target_task_id, execution_task_id, input_data FROM app_inbox_items WHERE source_id = 'user-1'")
      .get() as { app_id: string; target_task_id: string | null; execution_task_id: string | null; input_data: string };
    expect(row.app_id).toBe("may");
    expect(row.target_task_id).toBeNull();
    expect(typeof row.execution_task_id).toBe("string");
    expect(JSON.parse(row.input_data).context).toMatchObject({
      focusedTask: { appId: "may", taskId: "bg-work" },
      taskReply: { target: { appId: "may", taskId: "bg-work" }, taskGeneration: 1 },
    });
  } finally {
    runtime.close();
    const drained = closeInstalledAppTaskRuntimes(bus);
    gate.resolve();
    await drained;
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 10_000);
