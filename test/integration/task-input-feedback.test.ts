import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppInputAdmission } from "../../src/app/app-runtime.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { discoverAppDefinitions } from "../../src/app/adapters/discovery/app-definitions.js";
import { EventBus, EVENT_ROW_ID, type AgentEvent } from "../../src/app/core/events/bus.js";
import { createEventInterface, findEventPublication } from "../../src/app/core/events/interface.js";
import { createAppTaskEvents } from "../../src/app/core/tasks/app-task-emitter.js";
import { createAppInboxItem } from "../../src/app/core/state/app-inbox-store.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { fakeTaskAttacher } from "../fixtures/task-attachment.js";

test("public targeted input retains its receipt, attaches once and reaches only its live Task", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-input-feedback-"));
  const persistDir = join(root, "state");
  mkdirSync(join(root, "sample.app"));
  writeFileSync(
    join(root, "sample.app/app.js"),
    `export default {
    id: "sample", version: 1, agent: "owner", tasks: {},
    inputSchema: { type: "object", required: ["kind", "data"], properties: {
      kind: { const: "message" }, data: { type: "object" }
    } },
    conversation: { mode: "agent", inputKinds: ["message"], conversationId: "primary" },
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
  const attached: string[] = [];
  let conversations = 0;
  const runtime = await startAppInboxRuntime({
    registry,
    db,
    bus,
    scanIntervalMs: 60_000,
    attachTask: fakeTaskAttacher(db, ({ attachment }) => {
      if (attachment.kind !== "existing") throw new Error("Expected existing Task");
      attached.push(attachment.taskId);
      return { taskId: attachment.taskId };
    }),
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
    hasAgent: () => false,
    hasSession: () => false,
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
    expect(seen[0]![EVENT_ROW_ID]).toBe(receipt.eventId);
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
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 10_000);
