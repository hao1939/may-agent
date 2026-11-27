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
import { readAppConversationResource } from "../../src/app/core/state/conversations.js";
import { createAppTaskEvents } from "../../src/app/core/tasks/app-task-emitter.js";
import { createAppTaskCapability } from "../../src/app/core/tasks/app-task-capability.js";
import { appTaskContext, observeAppTaskIntent } from "../../src/app/core/tasks/app-task-reconciler.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../../src/app/core/tasks/app-task-runtime.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
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

test("separates May Conversation from cross-App Task inboxes while preserving same-App replies and exact approvals", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-conversation-boundary-"));
  const persistDir = join(root, "state");
  const writeApp = (dirName: string, appId: string) => {
    mkdirSync(join(root, dirName, "tasks"), { recursive: true });
    writeFileSync(
      join(root, dirName, "tasks", "seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
        resources: {
          question: {
            metadata: { id: "question", generation: 1, resourceVersion: 1 },
            spec: { parentId: "root", outcome: `Deliver ${appId}`, acceptance: ["Verified"] },
            status: { phase: "waiting", observedGeneration: 1, conditionIds: ["ask"], updatedAt: new Date().toISOString() },
          },
          proposal_task: {
            metadata: { id: "proposal_task", generation: 1, resourceVersion: 1 },
            spec: { parentId: "root", outcome: `Approve ${appId}`, acceptance: ["Approved"] },
            status: { phase: "waiting", observedGeneration: 1, conditionIds: ["release"], updatedAt: new Date().toISOString() },
          },
        },
        conditions: {
          ask: {
            metadata: { id: "ask", generation: 1, resourceVersion: 1 },
            spec: { type: "human.question", subject: `${appId}:env`, owner: "human", requestedAction: `Select env for ${appId}` },
            status: { state: "unknown", observedGeneration: 0 },
          },
          release: {
            metadata: { id: "release", generation: 1, resourceVersion: 1 },
            spec: {
              type: "project.approval.submitted",
              subject: `${appId}:release`,
              owner: "human",
              requestedAction: `Approve release for ${appId}`,
              expected: { allowedDecisions: ["approve", "reject"] },
            },
            status: { state: "unknown", observedGeneration: 0 },
          },
        },
      }),
    );
    writeFileSync(
      join(root, dirName, "app.js"),
      `export default {
        id: ${JSON.stringify(appId)}, version: 1, agent: "owner", tasks: {},
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: "message" }, data: { type: "object" }
        } },
        ${appId === "interface" ? 'conversation: { mode: "task", inputKinds: ["message"], conversationId: "primary" },' : ""}
        task() { throw new Error("Exact replies must bypass App task() mapper"); }
      };`,
    );
  };
  writeApp("interface.app", "interface");
  writeApp("worker.app", "worker");
  writeApp("worker-dot.app", "worker.app");

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
  const capability = createAppTaskCapability({ bus, db });
  let deferAttach = false;
  const runtime = await startAppInboxRuntime({
    registry,
    db,
    bus,
    scanIntervalMs: 60_000,
    attachTask: (input) => {
      if (deferAttach) throw new Error("transient attachment deferral");
      return capability.attach(input);
    },
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
  const service = new HumanTaskService(db, registry);
  const receipts: AgentEvent[] = [];
  const unlisten = bus.listen((event) => {
    if (event.type === "app.task.requested") receipts.push(event);
  });
  const publish = (id: string, extra: Record<string, unknown> = {}) =>
    events.publish(
      {
        type: "conversation.message.created",
        target: { appId: "interface" },
        idempotencyKey: id,
        data: { conversationId: "primary", author: { kind: "human", id }, text: "Use staging", ...extra },
      },
      { source: "control-socket" },
    );

  try {
    // 1. Passive focus never hijacks Conversation text into a background Task.
    publish("passive-focus", { context: { focusedTask: { appId: "interface", taskId: "question" } } });
    expect(db.prepare("SELECT app_id, target_task_id FROM app_inbox_items WHERE source_id = 'passive-focus'").get()).toEqual({
      app_id: "interface",
      target_task_id: null,
    });

    // 2. Cross-App reply stays in May's Conversation with referencedTaskReply context (never hijacks worker's inbox),
    // while formal approval resolves literal "worker.app" before ".app" suffix aliases.
    publish("cross-app-feedback", {
      replyTo: "dot-q-card",
      taskReply: {
        target: { appId: "worker.app", taskId: "question" },
        taskGeneration: 1,
        condition: { taskGeneration: 1, conditionId: "ask", conditionGeneration: 1 },
      },
    });
    const crossRow = db
      .prepare("SELECT app_id, target_task_id, input_data FROM app_inbox_items WHERE source_id = 'cross-app-feedback'")
      .get() as { app_id: string; target_task_id: string | null; input_data: string };
    expect(crossRow).toMatchObject({ app_id: "interface", target_task_id: null });
    expect(JSON.parse(crossRow.input_data).context.referencedTaskReply.target).toEqual({
      appId: "worker.app",
      taskId: "question",
    });

    const dotProposal = service.getTask({ appId: "worker.app", taskId: "proposal_task" })!.approvalProposal!;
    const plainProposal = service.getTask({ appId: "worker", taskId: "proposal_task" })!.approvalProposal!;
    const auth = {
      actor: { kind: "operator" as const, id: "op" },
      reference: "fixture:dot-approval",
      evidence: { decisionText: "approve" },
    };
    const collision = events.publish(
      {
        type: "conversation.message.created",
        target: { appId: "interface" },
        idempotencyKey: "collision-approve",
        data: {
          conversationId: "primary",
          author: { kind: "human", id: "op" },
          text: "approve",
          replyTo: "collision-card",
          taskReply: { target: { appId: "worker.app", taskId: "proposal_task" }, taskGeneration: 1 },
          approvalReply: { target: { appId: "worker", taskId: "proposal_task" }, proposal: plainProposal },
        },
      },
      { source: "control-socket", approvalAuthorization: auth },
    );
    expect(collision.approval).toHaveProperty("reason");

    const exactApprove = events.publish(
      {
        type: "conversation.message.created",
        target: { appId: "interface" },
        idempotencyKey: "exact-dot-approve",
        data: {
          conversationId: "primary",
          author: { kind: "human", id: "dot-approver" },
          text: "approve",
          replyTo: "dot-card",
          taskReply: { target: { appId: "worker.app", taskId: "proposal_task" }, taskGeneration: 1 },
          approvalReply: { target: { appId: "worker.app", taskId: "proposal_task" }, proposal: dotProposal },
        },
      },
      { source: "control-socket", approvalAuthorization: auth },
    );
    expect(exactApprove.approval).toMatchObject({ decision: "approve", eventId: expect.any(Number) });
    expect(readAppConversationResource(db, "interface", "primary").messages.some((m) => m.id === "dot-approver")).toBe(true);

    // 3. Same-App explicit reply attaches when current, and rejects stale question/proposal cards on deferred admission.
    publish("same-app-answer", {
      replyTo: "iface-q",
      taskReply: {
        target: { appId: "interface.app", taskId: "question" },
        taskGeneration: 1,
        condition: { taskGeneration: 1, conditionId: "ask", conditionGeneration: 1 },
      },
    });
    const deadline = Date.now() + 2_000;
    while (receipts.length < 1 && Date.now() < deadline) await Bun.sleep(5);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.target).toEqual({ project: "interface", taskId: "question" });

    const ifaceProposal = service.getTask({ appId: "interface", taskId: "proposal_task" })!.approvalProposal!;
    deferAttach = true;
    publish("deferred-same-p", {
      replyTo: "iface-p",
      taskReply: { target: { appId: "interface", taskId: "proposal_task" }, taskGeneration: 1 },
      approvalReply: { target: { appId: "interface", taskId: "proposal_task" }, proposal: ifaceProposal },
    });
    const ifaceStore = AppTaskResourceStore.activeFromDb(db, "interface")!;
    const pTask = ifaceStore.readTask("proposal_task")!;
    const pCond = ifaceStore.readTaskContext({ taskIds: ["proposal_task"] }).conditions!.release!;
    expect(
      ifaceStore.commit({
        fences: [{ taskId: "proposal_task", resourceVersion: pTask.metadata.resourceVersion }],
        conditions: [
          {
            ...pCond,
            metadata: { ...pCond.metadata, generation: 2, resourceVersion: 2 },
            spec: { ...pCond.spec, requestedAction: "Replacement release" },
          },
        ],
      }),
    ).toBe(true);
    deferAttach = false;
    const defRow = db.prepare("SELECT id FROM app_inbox_items WHERE source_id = 'deferred-same-p'").get() as { id: string };
    db.run("UPDATE app_inbox_items SET available_at = NULL WHERE id = ?", [defRow.id]);
    runtime.host.recoverAdmission(defRow.id);
    expect(runtime.host.get(defRow.id)).toMatchObject({ status: "done", handling: { phase: "failed" } });
    expect(receipts).toHaveLength(1);
  } finally {
    unlisten();
    runtime.close();
    const drained = closeInstalledAppTaskRuntimes(bus);
    gate.resolve();
    await drained;
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);
