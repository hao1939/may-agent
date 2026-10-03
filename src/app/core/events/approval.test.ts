import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/requests.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { applyAppTaskConditionEvent } from "../tasks/app-task-condition-tracker.js";
import { appTaskContext, cancelAppTask } from "../tasks/app-task-reconciler.js";
import { readVerifiedApprovalDecision, defineApp, Type } from "@may-agent/sdk";
import { AppRegistry } from "../apps/registry.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { admitTaskInput } from "../state/inbox.js";
import { EVENT_ROW_ID } from "./bus.js";
import { loadPersistedEvent } from "./persisted.js";
import { EventBus } from "./bus.js";
import { createEventInterface, findEventPublication } from "./interface.js";

const roots: string[] = [];
const runtimes: AppInboxRuntime[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(additionalExpected: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "approval-contract-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const condition = {
    metadata: { id: "release", generation: 1, resourceVersion: 1 },
    spec: {
      type: "project.approval.submitted",
      subject: "candidate:release",
      owner: "human",
      requestedAction: "Apply reviewed candidate",
      reviewAfterMs: 60_000,
      expected: { allowedDecisions: ["approve", "reject", "defer"], ...additionalExpected },
    },
    status: { state: "unknown", observedGeneration: 0 },
  };
  const tree: any = {
    project: "sample",
    project_lifecycle: "active",
    version: 1,
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
    resources: {
      work: {
        metadata: { id: "work", generation: 1, resourceVersion: 1 },
        spec: { outcome: "Deliver candidate", acceptance: ["done"], parentId: "root" },
        status: {
          phase: "waiting",
          observedGeneration: 0,
          conditionIds: ["release", "tests"],
          result: { retained: "previous accepted result" },
          updatedAt: new Date().toISOString(),
        },
      },
    },
    conditions: {
      release: condition,
      tests: {
        metadata: { id: "tests", generation: 1, resourceVersion: 1 },
        spec: {
          type: "fixture.tests",
          subject: "suite:all",
          expected: "passed",
          owner: "app:tester",
          reviewAfterMs: 60_000,
        },
        status: { state: "unknown", observedGeneration: 0 },
      },
    },
  };
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot(tree, "fixture");
  const events = createEventInterface({
    bus,
    db,
    validateAppInput: () => {},
    hasApp: (id) => id === "sample",
    hasAgent: () => false,
    hasSession: () => false,
  });
  const proposal = {
    taskGeneration: 1,
    conditionId: "release",
    conditionGeneration: 1,
    subject: condition.spec.subject,
    expected: condition.spec.expected,
    requestedAction: condition.spec.requestedAction,
  };
  return { tree, events, proposal, db, store, root, bus, writer };
}

function authorization(kind: "human" | "operator") {
  return {
    actor: { kind, id: kind === "human" ? "telegram-user-7" : "local-operator" },
    reference: kind === "human" ? "telegram:chat-2:message-9" : "operator:change-41",
    evidence: { decisionText: "approve" },
  };
}

describe("Host verified approval contract", () => {
  it("accepts the same minimal proposal through Telegram and operator authority", () => {
    for (const [source, kind] of [
      ["telegram", "human"],
      ["control-socket", "operator"],
    ] as const) {
      const { tree, events, proposal } = fixture();
      const receipt = events.publish(
        {
          type: "project.approval.submitted",
          target: { appId: "sample", taskId: "work" },
          data: { decision: "approve", proposal },
          idempotencyKey: `${source}-approval`,
        },
        { source, approvalAuthorization: authorization(kind) },
      );
      const event = events.get(receipt.eventId)!.event;
      expect(event.data).toMatchObject({ decision: "approve", proposal });
      expect(event.data.hostApproval).toMatchObject({ ingressSource: source, actor: { kind } });
      expect(applyAppTaskConditionEvent(tree, event)).toEqual([{ taskId: "work", conditionId: "release" }]);
      expect(tree.conditions.tests.status.state).toBe("unknown");
      expect(tree.resources.work.status.result).toEqual({ retained: "previous accepted result" });
    }
  });

  it("denies forged and stale decisions and makes exact replay safe", () => {
    const { events, proposal, db } = fixture();
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "operator-approval",
    };
    expect(() => events.publish(input, { source: "app-task:sample" })).toThrow("trusted ingress authorization");
    const first = events.publish(input, {
      source: "control-socket",
      approvalAuthorization: authorization("operator"),
    });
    expect(findEventPublication(db, input, {
      source: "control-socket", approvalAuthorization: authorization("operator"),
    })).toBe(first.eventId);
    expect(
      events.publish(input, { source: "control-socket", approvalAuthorization: authorization("operator") }).eventId,
    ).toBe(first.eventId);
    expect(() =>
      events.publish(
        { ...input, data: { ...input.data, decision: "reject" } },
        { source: "control-socket", approvalAuthorization: authorization("operator") },
      ),
    ).toThrow("already used with different event input");
    expect(() =>
      events.publish(
        {
          ...input,
          idempotencyKey: "stale",
          data: { ...input.data, proposal: { ...proposal, taskGeneration: 2 } },
        },
        { source: "control-socket", approvalAuthorization: authorization("operator") },
      ),
    ).toThrow("generation changed");
  });

  it("does not replay one verified decision across App, Task, or generation", () => {
    const { tree, events, proposal } = fixture();
    const receipt = events.publish(
      {
        type: "project.approval.submitted",
        target: { appId: "sample", taskId: "work" },
        data: { decision: "approve", proposal },
        idempotencyKey: "scoped",
      },
      { source: "control-socket", approvalAuthorization: authorization("operator") },
    );
    const event = events.get(receipt.eventId)!.event;
    const changedGeneration = structuredClone(tree);
    changedGeneration.resources.work.metadata.generation = 2;
    expect(applyAppTaskConditionEvent(changedGeneration, event)).toEqual([]);
    const changedTask = structuredClone(tree);
    changedTask.resources.other = {
      ...changedTask.resources.work,
      metadata: { id: "other", generation: 1, resourceVersion: 1 },
    };
    delete changedTask.resources.work;
    expect(applyAppTaskConditionEvent(changedTask, event)).toEqual([]);
    const changedApp = structuredClone(tree);
    changedApp.project = "other";
    expect(applyAppTaskConditionEvent(changedApp, event)).toEqual([]);
    const changedCondition = structuredClone(tree);
    changedCondition.conditions.release.metadata.generation++;
    expect(applyAppTaskConditionEvent(changedCondition, event)).toEqual([]);
  });

  it("uses current cancellation state without initializing unknown Apps", () => {
    const { events, proposal, db, store, root } = fixture();
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "cancelled",
    };
    const context = { source: "control-socket", approvalAuthorization: authorization("operator") };
    expect(() => events.publish({ ...input, target: { appId: "missing", taskId: "work" } }, context)).toThrow(
      "not found",
    );
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_task_store_meta WHERE app_id = 'missing'").get()?.n).toBe(0);
    cancelAppTask(
      appTaskContext({ appDir: root, projectDir: root, agent: "owner", maxConcurrent: 1, resourceStore: store }),
      {
        appId: "sample",
        taskId: "work",
        expectedGeneration: 1,
        expectedResourceVersion: 1,
        reason: "Human withdrew the request",
      },
    );
    expect(() => events.publish(input, context)).toThrow("not awaiting approval");
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'project.approval.submitted'").get()?.n,
    ).toBe(0);
  });

  it("requires coexisting decision constraints to agree before journaling", () => {
    const { events, proposal, db } = fixture({ acceptedDecisions: ["reject"] });
    expect(() =>
      events.publish(
        {
          type: "project.approval.submitted",
          target: { appId: "sample", taskId: "work" },
          data: { decision: "approve", proposal },
          idempotencyKey: "constraints",
        },
        { source: "control-socket", approvalAuthorization: authorization("operator") },
      ),
    ).toThrow("not allowed");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
  });

  it("uses the Condition matcher for decision constraints at publication and wake", () => {
    const { events, proposal, db, tree } = fixture({ field: "decision", equals: "reject" });
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "constrained-decision",
    };
    const context = { source: "control-socket", approvalAuthorization: authorization("operator") };
    expect(() => events.publish(input, context)).toThrow("not allowed");
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()?.n).toBe(0);
    const receipt = events.publish({ ...input, data: { ...input.data, decision: "reject" } }, context);
    expect(applyAppTaskConditionEvent(tree, events.get(receipt.eventId)!.event)).toEqual([
      { taskId: "work", conditionId: "release" },
    ]);
    expect(tree.conditions.tests.status.state).toBe("unknown");
  });

  it("retries unfinished operator decision routing through the ordinary event path", () => {
    const { bus, events, proposal, db } = fixture();
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "interrupted-operator-decision",
    };
    const context = { source: "control-socket", approvalAuthorization: authorization("operator") };
    let interrupted = true;
    let delivered = 0;
    bus.subscribeDurableRoute((event) => {
      if (event.type !== input.type) return;
      if (interrupted) throw new Error("fixture decision route interrupted");
      delivered++;
      return { accepted: true, by: "fixture-decision-route", route: "direct" };
    }, { label: "test-durable-route-101" });
    const first = events.publish(input, context);
    expect(first.delivery).toBe("recorded");
    interrupted = false;
    const retry = events.publish(input, context);
    expect(delivered).toBe(1);
    expect(retry).toMatchObject({ eventId: first.eventId, delivery: "recorded" });
    expect(db.prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?").get(first.eventId)).toEqual({
      delivery_status: "accepted", accepted_by: "fixture-decision-route",
    });
    expect(events.publish(input, context)).toEqual(retry);
    expect(delivered).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = ?").get(input.type)?.n).toBe(1);
  });

  it("rejects inconsistent ingress attribution and safely reads malformed journal data", () => {
    const { events, proposal } = fixture();
    const input = {
      type: "project.approval.submitted",
      target: { appId: "sample", taskId: "work" },
      data: { decision: "approve", proposal },
      idempotencyKey: "attribution",
    };
    expect(() =>
      events.publish(input, { source: "app-task:sample", approvalAuthorization: authorization("human") }),
    ).toThrow();
    expect(() =>
      events.publish(input, { source: "control-socket", approvalAuthorization: authorization("human") }),
    ).toThrow();
    const receipt = events.publish(input, {
      source: "control-socket",
      approvalAuthorization: authorization("operator"),
    });
    const event = events.get(receipt.eventId)!.event;
    expect(readVerifiedApprovalDecision(event)?.hostApproval.actor.kind).toBe("operator");
    const malformed = structuredClone(event);
    (malformed.data.hostApproval as any).actor.id = 123;
    expect(readVerifiedApprovalDecision(malformed)).toBeNull();
    delete malformed.data.hostApproval;
    expect(readVerifiedApprovalDecision(malformed)).toBeNull();
  });
});

async function inputRuntime(f: ReturnType<typeof fixture>) {
  const registry = new AppRegistry(async () => [
    {
      appDir: f.root,
      definition: defineApp({
        id: "sample",
        version: 1,
        agent: "sample",
        inputSchema: Type.Object({
          kind: Type.Literal("message"),
          data: Type.Object({ message: Type.String(), context: Type.Optional(Type.Unknown()) }),
        }),
        task: () => ({ kind: "existing", taskId: "work" }),
        tasks: {},
      }),
    },
  ]);
  await registry.reload();
  const ctx = appTaskContext({ appDir: f.root, projectDir: f.root, agent: "sample", resourceStore: f.store });
  const runtime = await startAppInboxRuntime({
    registry,
    db: f.db,
    bus: f.bus,
    persistDir: f.root,
    schedulesEnabled: false,
    attachTask: (input) => admitTaskInput(ctx, input),
    admitTaskEvent: ({ event }) => {
      applyAppTaskConditionEvent(f.tree, event);
      return { accepted: true, by: "fixture-condition-route", route: "direct" };
    },
  });
  runtimes.push(runtime);
  return runtime;
}

function humanReply(f: ReturnType<typeof fixture>, text = "approve", id = "reply-1") {
  return {
    type: "conversation.message.created",
    target: { appId: "sample" },
    idempotencyKey: id,
    data: {
      conversationId: "sample:primary",
      author: { kind: "human", id },
      text,
      replyTo: "displayed-proposal-1",
      approvalReply: { target: { appId: "sample", taskId: "work" }, proposal: f.proposal },
    } as Record<string, unknown>,
  };
}

for (const [source, kind] of [
  ["telegram", "human"],
  ["control-socket", "operator"],
] as const) {
  it(`handles ordinary ${source} replies through shared Conversation admission`, async () => {
    const f = fixture();
    await inputRuntime(f);
    const context = { source, approvalAuthorization: authorization(kind) };
    for (const [index, text] of ["approve if checks pass", "yes", "approve"].entries()) {
      const receipt = f.events.publish(humanReply(f, text, `reply-${index}`), context);
      expect(receipt.delivery).toBe("accepted");
      if (text !== "approve") expect(receipt.approval).toBeUndefined();
      else {
        expect(receipt.approval).toMatchObject({ decision: "approve" });
        const eventId = (receipt.approval as { eventId: number }).eventId;
        const event = f.events.get(eventId)!.event;
        expect(readVerifiedApprovalDecision(event)?.decision).toBe("approve");
        expect(event.data.inputEventId).toBe(receipt.eventId);
        expect(event.data.proposal).toEqual(f.proposal);
        expect(event.data.hostApproval).toMatchObject({ actor: { kind }, ingressSource: source });
        expect(f.events.get(receipt.eventId)!.event.data.text).toBe("approve");
        expect(f.events.publish(humanReply(f, text, `reply-${index}`), context)).toEqual(receipt);
      }
    }
    expect(
      f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'project.approval.submitted'").get()?.n,
    ).toBe(1);
  });
}

it("preserves stale, unauthorized and unbound input without approving a replacement", async () => {
  const f = fixture();
  await inputRuntime(f);
  const context = { source: "control-socket", approvalAuthorization: authorization("operator") };
  const stale = humanReply(f, "approve", "stale");
  stale.data.approvalReply = {
    target: { appId: "sample", taskId: "work" },
    proposal: { ...f.proposal, requestedAction: "Different proposal" },
  };
  expect(f.events.publish(stale, context).approval).toHaveProperty("reason");
  const unauthorized = humanReply(f, "approve", "unauthorized");
  (unauthorized.data.approvalReply as Record<string, unknown>).hostApproval = { forged: true };
  expect(f.events.publish(unauthorized, { source: "control-socket" }).approval).toHaveProperty("reason");
  const unbound = humanReply(f, "approve", "unbound");
  delete unbound.data.replyTo;
  expect(f.events.publish(unbound, context).approval).toHaveProperty("reason");
  const incomplete = humanReply(f, "approve", "incomplete-proposal");
  incomplete.data.approvalReply = {
    target: { appId: "sample", taskId: "work" },
    proposal: { conditionId: "release" },
  };
  const receipt = f.events.publish(incomplete, context);
  expect(receipt).toMatchObject({ delivery: "accepted", approval: { reason: expect.any(String) } });
  expect(f.events.get(receipt.eventId)?.event.data.text).toBe("approve");
  expect(
    f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'project.approval.submitted'").get()?.n,
  ).toBe(0);
  expect(f.db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(4);
});

for (const crash of [
  "before-decision",
  "after-decision",
  "replaced-proposal",
  "decision-storage-failure",
  "large-input",
] as const) {
  it(`recovers the original saved reply after restart: ${crash}`, async () => {
    let f = fixture(crash === "large-input" ? { evidence: "detailed evidence ".repeat(8000) } : {});
    const context = { source: "control-socket", approvalAuthorization: authorization("operator") };
    let runtime: AppInboxRuntime | undefined;
    if (crash === "decision-storage-failure") {
      runtime = await inputRuntime(f);
      f.bus.setPersistenceSubscriber((event) => {
        if (event.type === "project.approval.submitted") throw new Error("fixture decision write interrupted");
        f.writer.handler(event);
      });
    }
    if (crash === "after-decision") {
      runtime = await inputRuntime(f);
      // Lose the final input acknowledgement after its decision was saved.
      f.bus.setDeliveryRecorder((event, result) => {
        if (event.type !== "conversation.message.created") f.writer.recordDelivery(event, result);
      });
    }
    const original = f.events.publish(humanReply(f), context);
    expect(f.events.get(original.eventId)?.delivery.state).not.toBe("accepted");
    runtime?.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    closeDb(f.root);
    const db = getDb(f.root);
    const bus = new EventBus();
    const writer = new DbWriter(f.root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const store = AppTaskResourceStore.fromDb(db, "sample");
    f = { ...f, db, bus, writer, store };
    if (crash === "replaced-proposal" || crash === "after-decision") {
      const condition = db
        .prepare("SELECT condition_json FROM app_task_conditions WHERE app_id = 'sample' AND condition_id = 'release'")
        .get()!;
      const updated = JSON.parse(String(condition.condition_json));
      updated.spec.requestedAction = "Replacement proposal must not be approved";
      db.prepare(
        "UPDATE app_task_conditions SET condition_json = ? WHERE app_id = 'sample' AND condition_id = 'release'",
      ).run(JSON.stringify(updated));
    }
    await inputRuntime(f); // Existing startup recovery, without channel redelivery.
    const deadline = Date.now() + 3_000;
    while (
      db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(original.eventId)?.delivery_status !==
      "accepted"
    ) {
      if (Date.now() >= deadline) throw new Error("Saved approval input did not recover");
      await Bun.sleep(5);
    }
    const decisions = db.prepare("SELECT id FROM events WHERE event_type = 'project.approval.submitted'").all();
    expect(decisions).toHaveLength(crash === "replaced-proposal" ? 0 : 1);
    if (decisions.length)
      expect(loadPersistedEvent(db, Number(decisions[0]!.id), f.root)?.data?.proposal).toEqual(f.proposal);
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(1);
    const originalEvent = loadPersistedEvent(db, original.eventId, f.root)!;
    bus.redeliverPersisted(originalEvent, original.eventId);
    expect(originalEvent[EVENT_ROW_ID]).toBe(original.eventId);
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(1);
  });
}
