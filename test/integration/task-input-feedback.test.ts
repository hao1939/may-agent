import { attachTelegramBot } from "../../src/app/transport/telegram.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
import { readAppConversationResource } from "../../src/app/core/state/conversations.js";
import { applyTaskCommunication } from "../../src/app/core/tasks/task-communication.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
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
import { createAppInboxItem, inputConversationAppId } from "../../src/app/core/state/app-inbox-store.js";
import { createAppTaskEvents } from "../../src/app/core/tasks/app-task-emitter.js";
import { createAppTaskCapability } from "../../src/app/core/tasks/app-task-capability.js";
import { appTaskContext, claimObservedAppTask, observeAppTaskIntent } from "../../src/app/core/tasks/app-task-reconciler.js";
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

// Real configured Conversation admission and owning Task receipts, without a
// model call. The start gate blocks execution, not journal/admission writes.
for (const ownerApp of ["interface", "worker", "restrictive"]) {
  test(`displayed question reaches its ${ownerApp} owner; passive views stay Conversation`, async () => {
    const root = mkdtempSync(join(tmpdir(), "human-question-ingress-"));
    const persistDir = join(root, "state");
    for (const appId of ["interface", "interface2", "worker", "restrictive"]) {
      mkdirSync(join(root, `${appId}.app/tasks`), { recursive: true });
      writeFileSync(join(root, `${appId}.app/tasks/seed.json`), JSON.stringify({
        root_task_id: "root", groups: { root: { id: "root", parent_id: null } },
        resources: {
          question: {
            metadata: { id: "question", generation: 1, resourceVersion: 1 },
            spec: { parentId: "root", outcome: "Choose a fixture environment", acceptance: ["Choice considered"] },
            status: { phase: "waiting", observedGeneration: 1, conditionIds: ["environment"], updatedAt: new Date().toISOString() },
          },
        },
        conditions: {
          environment: {
            metadata: { id: "environment", generation: 1, resourceVersion: 1 },
            spec: { type: "fixture.choice", subject: "environment", owner: "human", requestedAction: "Choose an environment" },
            status: { state: "unknown", observedGeneration: 0 },
          },
        },
      }));
      writeFileSync(join(root, `${appId}.app/app.js`), `export default {
        id: ${JSON.stringify(appId)}, version: 1, agent: "owner", tasks: {},
        inputSchema: { type: "object", required: ["kind", "data"], properties: {
          kind: { const: ${JSON.stringify(appId === "restrictive" ? "probe" : "message")} }, data: { type: "object" }
        } },
        ${appId.startsWith("interface") ? 'conversation: { mode: "task", inputKinds: ["message"], conversationId: "primary" },' : ""}
        task() { throw new Error("An exact reply must bypass mapping"); }
      };`);
    }
    const db = getDb(persistDir);
    const bus = new EventBus();
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const registry = new AppRegistry(discoverAppDefinitions(root));
    await registry.reload();
    const gate = Promise.withResolvers<void>();
    await installAppTaskRuntimes({
      projectRoot: root, projectsRoot: root, persistDir, bus,
      appRegistrySnapshot: registry.snapshot(), startAfter: gate.promise,
    }, { deferRecovery: true });
    const capability = createAppTaskCapability({ bus, db });
    const runtime = await startAppInboxRuntime({
      registry, db, bus, scanIntervalMs: 60_000,
      attachTask: capability.attach, admitConversation: capability.admitConversation,
      admitTaskEvent: capability.admitEvent, hasTaskTarget: capability.has,
      previewTaskEvent: capability.previewEvent, previewTaskEventRoutes: capability.previewEventRoutes,
    });
    const events = createEventInterface({
      bus, db, hasApp: id => runtime.host.hasApp(id),
      validateAppInput: (id, input) => runtime.host.assertAcceptsInput(id, input),
    });
    const receipts: AgentEvent[] = [];
    const unlisten = bus.listen(event => { if (event.type === "app.task.requested") receipts.push(event); });
    const publish = (id: string, extra: Record<string, unknown> = {}, source = "control-socket") => events.publish({
      type: "conversation.message.created", target: { appId: "interface" }, idempotencyKey: id,
      data: { conversationId: "primary", author: { kind: "human", id }, text: "Use the isolated fixture", ...extra },
    }, { source });
    const waitFor = async (count: number) => {
      const deadline = Date.now() + 2_000;
      while (receipts.length < count && Date.now() < deadline) await Bun.sleep(5);
      expect(receipts).toHaveLength(count);
    };
    try {
      const target = { appId: ownerApp, taskId: "question" };
      const condition = { taskGeneration: 1, conditionId: "environment", conditionGeneration: 1 };
      const taskReply = { target, taskGeneration: 1, condition };
      // Older passive clients, explicit single/multi-Task views, and no view all
      // admit once to the real retained Conversation executor, never the watch.
      for (const [index, context] of [
        {}, { focusedTask: { appId: "interface", taskId: "question" } },
        { focusedTask: { appId: "worker", taskId: "question" } },
        { taskRefs: [{ appId: "interface", taskId: "question" }, { appId: "worker", taskId: "question" }] },
        { focusedTask: target, displayedHumanCondition: condition },
        { focusedTask: target, displayedHumanCondition: condition, ingress: { provider: "telegram", replyToMessageId: 7 } },
      ].entries()) {
        const first = publish(`passive-${index}`, { context });
        expect(publish(`passive-${index}`, { context }).eventId).toBe(first.eventId);
      }
      const rows = db.prepare("SELECT target_task_id, execution_task_id FROM app_inbox_items").all();
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row.target_task_id).toBeNull();
        expect(typeof row.execution_task_id).toBe("string");
      }
      const before = receipts.length;
      if (ownerApp === "restrictive") {
        const first = publish("unsupported-reply", { replyTo: "shown-question", taskReply });
        expect(first.delivery).toBe("accepted");
        expect(publish("unsupported-reply", { replyTo: "shown-question", taskReply }).eventId).toBe(first.eventId);
        const retained = db.prepare("SELECT app_id, target_task_id, input_data FROM app_inbox_items WHERE source_id = 'unsupported-reply'").get()!;
        expect(retained).toMatchObject({ app_id: "interface", target_task_id: null });
        expect(JSON.parse(String(retained.input_data))).toMatchObject({
          message: "Use the isolated fixture", context: { taskReplyNotice: expect.stringContaining("ordinary conversation") },
        });
        expect(JSON.parse(String(retained.input_data)).context.taskReply).toBeUndefined();
        expect(receipts.filter(event => event.target?.taskId === "question")).toHaveLength(0);
        expect(readAppConversationResource(db, "interface", "primary").messages.filter(message => message.id === "unsupported-reply"))
          .toHaveLength(1);
        return;
      }
      // Simulate a committed owner admission with an unconfirmed outer HTTP
      // receipt. Retrying must run the retained route, not today's card lookup.
      bus.setDeliveryRecorder((event, result) => {
        if (event.type === "conversation.message.created" && event.data.idempotencyKey === "deliberate") return;
        writer.recordDelivery(event, result);
      });
      const admitted = publish("deliberate", { replyTo: "shown-question", taskReply });
      expect(admitted.delivery).toBe("recorded");
      await waitFor(before + 1);
      const received = receipts.at(-1)!;
      expect(received.source).toBe("human");
      expect(received.target).toEqual({ project: ownerApp, taskId: "question" });
      expect(received.data).toMatchObject({ ...condition, request: {
        source: { kind: "human", id: "deliberate" }, input: { data: { message: "Use the isolated fixture" } },
      } });
      const requestId = (received.data.request as { id: string }).id;
      const shown = readAppConversationResource(db, "interface", "primary");
      expect(shown.messages.filter(message => message.id === "deliberate")).toHaveLength(1);
      if (ownerApp !== "interface") expect(readAppConversationResource(db, ownerApp, "primary").messages
        .some(message => message.id === "deliberate")).toBe(false);
      expect(events.get(admitted.eventId)!.links).toContainEqual({ kind: "request", id: requestId, state: "handling" });
      const store = AppTaskResourceStore.activeFromDb(db, ownerApp)!;
      const item = runtime.host.get(requestId)!;
      // The durable envelope retains the address even after journal retention.
      expect(inputConversationAppId(db, { ...item, originEventId: undefined })).toBe("interface");
      const retained = store.readTaskContext({ taskIds: [], admissionIds: [item.taskAdmissionKey!] })
        .appTaskAdmissions![item.taskAdmissionKey!]!;
      expect(retained.inputEvent?.data).toMatchObject({ ...condition, request: { source: { kind: "human", id: "deliberate" } } });
      // Input is not a decision, automatic Condition fulfillment or external completion.
      const task = store.readTask("question")!;
      const question = store.readTaskContext({ taskIds: ["question"] }).conditions!.environment!;
      expect(question.status.state).toBe("unknown");
      expect(question.metadata.generation).toBe(1);
      expect(store.commit({
        fences: [{ taskId: "question", resourceVersion: task.metadata.resourceVersion }],
        conditions: [{ ...question, metadata: { ...question.metadata, generation: 2, resourceVersion: 2 } }],
      })).toBe(true);
      const count = db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()!.n;
      // Reusing the original HTTP identity after a lost response must retain the
      // saved route/receipt, even though its question has since been replaced.
      bus.setDeliveryRecorder(writer.recordDelivery);
      const retried = publish("deliberate", { replyTo: "shown-question", taskReply });
      expect(retried.eventId).toBe(admitted.eventId);
      expect(retried.delivery).toBe("accepted");
      expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()!.n).toBe(count);
      // A new send to that stale card stays an honest ordinary Conversation turn.
      publish("stale", { replyTo: "shown-question", taskReply });
      expect(db.prepare("SELECT target_task_id, execution_task_id FROM app_inbox_items WHERE source_id = 'stale'").get())
        .toMatchObject({ target_task_id: null, execution_task_id: rows[0]!.execution_task_id });
      expect(receipts.filter(event => event.target?.taskId === "question")).toHaveLength(1);
      // The old complete native-question format remains deliberate evidence.
      const legacy = publish("legacy-telegram", { context: {
        focusedTask: target, displayedHumanCondition: { ...condition, conditionGeneration: 2 },
        ingress: { provider: "telegram", replyToMessageId: 7 },
      } }, "telegram");
      expect(legacy.delivery).toBe("accepted");
      await waitFor(before + 2);
      expect(receipts.at(-1)!.data).toMatchObject({ ...condition, conditionGeneration: 2 });
      // Exercise the shipped native adapter, not self-asserted HTTP provider metadata.
      const previousFetch = globalThis.fetch;
      const previousToken = process.env.TELEGRAM_BOT_TOKEN;
      const previousChat = process.env.TELEGRAM_CHAT_ID;
      let poll: ((updates: unknown[]) => void) | undefined;
      const sent: Array<{ text: string; messageId: number }> = [];
      globalThis.fetch = (async (url, init) => {
        const method = String(url).split("/").at(-1);
        if (method === "getMe") return Response.json({ ok: true, result: { username: "fixture" } });
        if (method === "getUpdates") return Response.json({ ok: true,
          result: await new Promise<unknown[]>(resolve => { poll = resolve; }) });
        if (method === "sendMessage") {
          const body = JSON.parse(String(init?.body)) as { text: string };
          const messageId = 1000 + sent.length;
          sent.push({ text: body.text, messageId });
          return Response.json({ ok: true, result: { message_id: messageId } });
        }
        return Response.json({ ok: true, result: true });
      }) as typeof fetch;
      process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
      process.env.TELEGRAM_CHAT_ID = "42";
      const service = new HumanTaskService(db, registry);
      const bot = attachTelegramBot({ persistDir, bus, interfaceAgent: "owner", conversationAppId: "interface",
        conversationId: "primary", humanTasks: service,
        getAppConversation: (appId, conversationId, options) => readAppConversationResource(db, appId, conversationId, options),
        publishEvent: (input, approvalAuthorization) => events.publish(input, { source: "telegram", approvalAuthorization }),
      });
      const until = async (test: () => boolean) => {
        const end = Date.now() + 2000;
        while (!test() && Date.now() < end) await Bun.sleep(5);
        expect(test()).toBe(true);
      };
      const deliver = async (message: Record<string, unknown>, id: number) => {
        await until(() => Boolean(poll));
        const resolve = poll!; poll = undefined;
        resolve([{ update_id: id, message: { message_id: id, chat: { id: 42 }, from: { id: 7 }, ...message } }]);
      };
      try {
        const ref = service.getTask(target)!.ref;
        await deliver({ text: `/watch ${ref}` }, 100);
        await until(() => sent.some(message => message.text.includes("Following updates.")));
        const card = sent.find(message => message.text.includes("Following updates."))!;
        expect(card.text).toContain("Following updates. Reply to this message with an exact response");
        expect(card.text).not.toContain("Reply here to discuss this work");
        await until(() => Boolean(db.prepare("SELECT 1 FROM notification_messages WHERE chat_id = '42' AND telegram_msg_id = ?")
          .get(card.messageId)));
        const message = { text: "Use the native fixture", reply_to_message: { message_id: card.messageId, text: card.text } };
        await deliver(message, 101);
        await waitFor(before + 3);
        const native = receipts.at(-1)!;
        expect(native.source).toBe("human");
        expect(native.target).toEqual({ project: ownerApp, taskId: "question" });
        expect(native.data).toMatchObject({ ...condition, conditionGeneration: 2, request: {
          source: { kind: "human", id: "telegram:42:101" }, input: { data: { message: "Use the native fixture" } },
        } });
        const nativeCount = db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()!.n;
        await deliver(message, 101); // Provider redelivery reuses the saved admission.
        await until(() => Boolean(poll));
        expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()!.n).toBe(nativeCount);
        expect(readAppConversationResource(db, "interface", "primary").messages.filter(message => message.id === "telegram:42:101"))
          .toHaveLength(1);
      } finally {
        bot.close(); globalThis.fetch = previousFetch;
        if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = previousToken;
        if (previousChat === undefined) delete process.env.TELEGRAM_CHAT_ID; else process.env.TELEGRAM_CHAT_ID = previousChat;
      }
      const config = appTaskContext({
        appDir: join(root, `${ownerApp}.app`), projectDir: join(root, `${ownerApp}.app`),
        agent: "owner", maxConcurrent: 1, resourceStore: store,
      });
      const claim = claimObservedAppTask(config, { taskId: "question", appAgent: "owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error("Expected owning Task claim");
      const communication = createAppTaskEvents({ bus, db, appId: ownerApp, claim, communication: true });
      stateTransaction(db, () => applyTaskCommunication(config, claim, [{
        id: "answer-human", inputId: requestId, message: "The owner received your choice; verification is still needed.",
      }], communication));
      const answer = db.prepare("SELECT data FROM events WHERE event_type = 'conversation.message.created' AND json_extract(data, '$.communication.id') = 'answer-human'")
        .get() as { data: string };
      expect(JSON.parse(answer.data)).toMatchObject({
        appId: "interface", conversationId: "primary", replyTo: "deliberate",
        metadata: { taskRefs: [{ appId: ownerApp, taskId: "question" }] },
      });
      if (ownerApp !== "interface") expect(() => stateTransaction(db, () => applyTaskCommunication(config, claim, [{
        id: "not-a-promise-transfer", inputId: requestId,
        requestUpdates: [{ id: "caller-promise", expectedRevision: 0, disposition: "open", scope: "Not transferred" }],
      }], communication))).toThrow("cannot update another App");
      // A Console proposal reply carries both bindings. Replacing the shown
      // proposal at the same Task generation must not degrade to direct feedback.
      const currentTask = store.readTask("question")!;
      const currentQuestion = store.readTaskContext({ taskIds: ["question"] }).conditions!.environment!;
      const approvalCondition = { ...currentQuestion,
        metadata: { ...currentQuestion.metadata, generation: 3, resourceVersion: 3 },
        spec: { type: "project.approval.submitted", subject: "fixture:proposal", owner: "human",
          requestedAction: "Apply the isolated fixture", expected: { allowedDecisions: ["approve", "reject"] } },
      };
      expect(store.commit({
        fences: [{ taskId: "question", resourceVersion: currentTask.metadata.resourceVersion }],
        conditions: [approvalCondition],
      })).toBe(true);
      const proposal = service.getTask(target)!.approvalProposal!;
      expect(proposal).toBeDefined();
      const consoleReply = { replyTo: "displayed-proposal", taskReply: { target, taskGeneration: 1 },
        approvalReply: { target, proposal } };
      const beforeProposal = receipts.length;
      publish("proposal-feedback", consoleReply);
      await waitFor(beforeProposal + 1);
      expect(receipts.at(-1)!.target).toEqual({ project: ownerApp, taskId: "question" });
      const decide = (id: string, reply = consoleReply) => events.publish({
        type: "conversation.message.created", target: { appId: "interface" }, idempotencyKey: id,
        data: { conversationId: "primary", author: { kind: "human", id }, text: "approve", ...reply },
      }, { source: "control-socket", approvalAuthorization: {
        actor: { kind: "operator", id: "fixture-operator" }, reference: "fixture:decision",
        evidence: { decisionText: "approve" },
      } });
      const mismatched = decide("mismatched-decision", {
        ...consoleReply, taskReply: { target, taskGeneration: 2 },
      });
      expect(mismatched.approval).toHaveProperty("reason");
      expect(db.prepare("SELECT target_task_id FROM app_inbox_items WHERE source_id = 'mismatched-decision'").get())
        .toEqual({ target_task_id: null });
      for (const [id, binding] of [
        ["mismatched-proposal-target", { ...consoleReply, taskReply: {
          target: { appId: ownerApp === "interface" ? "worker" : "interface", taskId: "question" }, taskGeneration: 1 } }],
        ["mismatched-proposal-generation", { ...consoleReply, taskReply: { target, taskGeneration: 2 } }],
        ["missing-proposal", { ...consoleReply, approvalReply: { target, proposal: {} } }],
      ] as const) {
        publish(id, binding);
        expect(db.prepare("SELECT target_task_id FROM app_inbox_items WHERE source_id = ?").get(id))
          .toEqual({ target_task_id: null });
      }
      const formal = decide("proposal-decision");
      expect(formal.approval).toMatchObject({ decision: "approve", eventId: expect.any(Number) });
      // The exact decision may settle its approval Condition before ordinary
      // input routing; it must not be relabeled as another question receipt.
      const replacingTask = store.readTask("question")!;
      expect(store.commit({
        fences: [{ taskId: "question", resourceVersion: replacingTask.metadata.resourceVersion }],
        conditions: [{ ...approvalCondition,
          metadata: { ...approvalCondition.metadata, generation: 4, resourceVersion: 4 },
          spec: { ...approvalCondition.spec, requestedAction: "Apply the replacement fixture" } }],
      })).toBe(true);
      publish("replaced-proposal-feedback", consoleReply);
      expect(db.prepare("SELECT target_task_id FROM app_inbox_items WHERE source_id = 'replaced-proposal-feedback'").get())
        .toEqual({ target_task_id: null });
      expect(receipts.filter(event => event.target?.taskId === "question")).toHaveLength(4);
      expect(readAppConversationResource(db, "interface", "primary").messages
        .some(message => message.id === "replaced-proposal-feedback" && message.text === "Use the isolated fixture")).toBe(true);
      // Journal retention cannot erase the saved originating Conversation or
      // relabel another App's same-named Task history after a storage reopen.
      db.prepare("DELETE FROM events WHERE id = ?").run(admitted.eventId);
      expect(readAppConversationResource(db, "interface", "primary").messages.filter(message => message.id === "deliberate"))
        .toHaveLength(1);
      runtime.close();
      const stopped = closeInstalledAppTaskRuntimes(bus);
      gate.resolve();
      await stopped;
      closeDb(persistDir);
      const reopened = getDb(persistDir);
      expect(readAppConversationResource(reopened, "interface", "primary").messages.filter(message => message.id === "deliberate"))
        .toHaveLength(1);
      if (ownerApp !== "interface") expect(readAppConversationResource(reopened, ownerApp, "primary").messages
        .some(message => message.id === "deliberate")).toBe(false);
      // Restart the actual Host admission composition after origin-event retention.
      // Owner execution/results must wake the original Conversation, not a
      // same-named Conversation on the worker App.
      const recoveredBus = new EventBus();
      const recoveredWriter = new DbWriter(persistDir);
      recoveredBus.setPersistenceSubscriber(recoveredWriter.handler);
      recoveredBus.setDeliveryRecorder(recoveredWriter.recordDelivery);
      const recoveredGate = Promise.withResolvers<void>();
      await installAppTaskRuntimes({
        projectRoot: root, projectsRoot: root, persistDir, bus: recoveredBus,
        appRegistrySnapshot: registry.snapshot(), startAfter: recoveredGate.promise,
      }, { deferRecovery: true });
      const reopenedStore = AppTaskResourceStore.activeFromDb(reopened, ownerApp)!;
      expect(reopenedStore.readTaskContext({ taskIds: [], admissionIds: [item.taskAdmissionKey!] })
        .appTaskAdmissions![item.taskAdmissionKey!]!.inputEvent?.data).toMatchObject({
          ...condition, request: { source: { kind: "human", id: "deliberate" } },
        });
      const recoveredCapability = createAppTaskCapability({ bus: recoveredBus, db: reopened });
      const recoveredRuntime = await startAppInboxRuntime({
        registry, db: reopened, bus: recoveredBus, scanIntervalMs: 60_000,
        attachTask: recoveredCapability.attach, admitConversation: recoveredCapability.admitConversation,
        admitTaskEvent: recoveredCapability.admitEvent, hasTaskTarget: recoveredCapability.has,
        previewTaskEvent: recoveredCapability.previewEvent, previewTaskEventRoutes: recoveredCapability.previewEventRoutes,
      });
      const wakes: AgentEvent[] = [];
      const stopWakes = recoveredBus.listen(event => { if (event.type === "conversation.updated") wakes.push(event); });
      try {
        const waitForWake = async () => {
          const deadline = Date.now() + 2000;
          while (!wakes.length && Date.now() < deadline) await Bun.sleep(5);
          expect(wakes.length).toBeGreaterThan(0);
        };
        // Observe an explicit startup barrier rather than sleeping and assuming
        // that any pending presentation wake has drained.
        recoveredBus.emit({ type: "conversation.message.created", source: "fixture", data: {
          appId: "interface", conversationId: "primary", author: { kind: "command", id: "restart-barrier" },
          text: "Fixture storage reopened",
        } });
        await waitForWake();
        for (const type of ["project.task.reconcile.started", "project.task.reconciled"]) {
          wakes.length = 0;
          recoveredBus.emit({ type, source: "fixture", data: { project: ownerApp, taskId: "question", attemptId: claim.attemptId } });
          await waitForWake();
          expect(wakes.map(event => event.data)).toEqual([{ appId: "interface", conversationId: "primary" }]);
          const history = readAppConversationResource(reopened, "interface", "primary");
          expect(history.messages.filter(message => message.id === "deliberate")).toHaveLength(1);
          expect(history.messages.some(message => message.text === "The owner received your choice; verification is still needed."))
            .toBe(true);
        }
        if (ownerApp === "worker") {
          const recoveredEvents = createEventInterface({ bus: recoveredBus, db: reopened,
            hasApp: id => recoveredRuntime.host.hasApp(id),
            validateAppInput: (id, input) => recoveredRuntime.host.assertAcceptsInput(id, input),
          });
          const send = (origin: string) => recoveredEvents.publish({
            type: "conversation.message.created", target: { appId: origin }, idempotencyKey: "turn-1",
            data: { conversationId: "primary", author: { kind: "human", id: `human-${origin}` },
              text: `Feedback from ${origin}`, taskReply: { target, taskGeneration: 1 } },
          }, { source: "control-socket" });
          recoveredBus.setDeliveryRecorder((event, result) => {
            if (event.type !== "conversation.message.created" || event.data.idempotencyKey !== "turn-1")
              recoveredWriter.recordDelivery(event, result);
          });
          const publications = ["interface", "interface2", "worker"].map(origin => send(origin));
          const exact = reopened.prepare("SELECT id, origin_event_id, idempotency_key, source_id, task_admission_key FROM app_inbox_items WHERE source_id LIKE 'human-%' ORDER BY source_id").all();
          expect(exact).toHaveLength(3);
          expect(new Set(exact.map(row => row.idempotency_key)).size).toBe(3);
          for (const row of exact) {
            const key = String(row.task_admission_key);
            expect(reopenedStore.readTaskContext({ taskIds: [], admissionIds: [key] }).appTaskAdmissions![key]!)
              .toMatchObject({ taskId: "question", inputEvent: { source: "human", data: { request: {
                source: { kind: "human", id: row.source_id },
              } } } });
          }
          // Simulate a retained pre-upgrade inbox key, then recreate the Host.
          reopened.run("UPDATE app_inbox_items SET idempotency_key = 'turn-1' WHERE origin_event_id = ?", [publications[0]!.eventId]);
          recoveredRuntime.close();
          const retryRuntime = await startAppInboxRuntime({ registry, db: reopened, bus: recoveredBus, scanIntervalMs: 60_000,
            attachTask: recoveredCapability.attach, admitConversation: recoveredCapability.admitConversation,
            admitTaskEvent: recoveredCapability.admitEvent, hasTaskTarget: recoveredCapability.has,
            previewTaskEvent: recoveredCapability.previewEvent, previewTaskEventRoutes: recoveredCapability.previewEventRoutes,
          });
          try {
            recoveredBus.setDeliveryRecorder(recoveredWriter.recordDelivery);
            for (const [index, origin] of ["interface", "interface2", "worker"].entries()) {
              const retry = send(origin);
              expect(retry).toMatchObject({ eventId: publications[index]!.eventId, delivery: "accepted" });
            }
            expect(reopened.prepare("SELECT id FROM app_inbox_items WHERE source_id LIKE 'human-%'").all()).toHaveLength(3);
          } finally { retryRuntime.close(); }
        }
      } finally {
        stopWakes();
        recoveredRuntime.close();
        const drained = closeInstalledAppTaskRuntimes(recoveredBus);
        recoveredGate.resolve();
        await drained;
      }
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
}
