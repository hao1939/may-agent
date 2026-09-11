import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { createAppInboxItem, claimAppInboxItem, completeAppInboxClaim } from "../state/app-inbox-store.js";
import { createRuntimeAppRead } from "../reads/app-read.js";
import { childEventTrace, EVENT_ROW_ID, eventData, EventBus } from "./bus.js";
import { createEventInterface } from "./interface.js";
import { createAppEventAdmissionPlan, recordAppEventAdmissionCommandFailure } from "../state/app-event-admission-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-event-interface-"));
  roots.push(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const db = getDb(root);
  const events = createEventInterface({
    bus,
    db,
    acceptsAppInput: (appId, input) => appId === "sample" && input.kind === "message",
    hasApp: (appId) => appId === "sample",
    hasAgent: (agent) => agent === "may",
    hasSession: (sessionId) => sessionId === "s_known",
  });
  return { bus, db, events };
}

describe("simple event interface", () => {
  it("reports an async subscriber failure without changing a committed result or blocking another report", async () => {
    const { db, events } = fixture();
    createAppInboxItem(db, {
      id: "request/report",
      appId: "sample",
      source: { kind: "system", id: "fixture" },
      input: { kind: "message", data: {} },
      now: 100,
    });
    const claim = claimAppInboxItem(db, "request/report", "fixture", 1000, 100)!;
    completeAppInboxClaim(db, claim, { summary: "Accepted work", evidence: ["fixture"] }, 200);
    const read = createRuntimeAppRead({ getDb: () => db });
    const failure = Promise.withResolvers<void>();
    const report = Promise.withResolvers<unknown>();
    const stops = [
      events.subscribe({ types: ["fixture.changed"] }, async () => {
        await Promise.resolve();
        throw new Error("fixture observer failed");
      }),
      events.subscribe({ types: ["fixture.changed"] }, async () => {
        report.resolve(await read.appResult("request/report"));
      }),
      events.subscribe({ types: ["subscriber.failed"] }, () => {
        failure.resolve();
      }),
    ];
    try {
      const receipt = events.publish(
        { type: "fixture.changed", data: {} },
        { source: "fixture", allowUnregisteredFact: true },
      );
      await failure.promise;
      await expect(report.promise).resolves.toMatchObject({ summary: "Accepted work" });
      expect(events.get(receipt.eventId)?.delivery.state).toBe("recorded");
      await expect(read.appResult("request/report")).resolves.toMatchObject({ summary: "Accepted work" });
      expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
        count: 1,
      });
    } finally {
      for (const stop of stops) stop();
    }
  });

  it("keeps operator diagnostics readable by ID and stream without granting public publication", async () => {
    const { bus, events } = fixture();
    const seen = Promise.withResolvers<void>();
    const observed: Array<{ id?: number; type: string; data: Record<string, unknown> }> = [];
    const stop = events.subscribe(
      { types: ["project.task.reconciled", "project.task.reconcile.profiled"] },
      (event) => {
        observed.push(event);
        if (observed.length === 2) seen.resolve();
      },
    );
    try {
      expect(() => events.publish({ type: "project.task.reconciled", data: {} }, { source: "http" })).toThrow(
        "not admitted",
      );
      for (const type of ["project.task.reconciled", "project.task.reconcile.profiled"]) {
        bus.emit({
          type,
          source: "app-task:sample",
          owner: "project:sample",
          data: { project: "sample", taskId: "work/main", disposition: "stale", summary: "Not an accepted result" },
        } as never);
      }
      await seen.promise;
      for (const event of observed) {
        const view = events.get(event.id!);
        expect(view?.event.type).toBe(event.type);
        expect(view?.event.data).toMatchObject(event.data);
        expect(view?.delivery.state).toBe("recorded");
        expect(view?.links).toEqual([]);
      }
    } finally {
      stop();
    }
  });
  it("keeps an async observer ordered without delaying admission or independent observers", async () => {
    const { db, events } = fixture();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const independent = Promise.withResolvers<void>();
    const drained = Promise.withResolvers<void>();
    const observed: number[] = [];
    const stopSlow = events.subscribe({ types: ["fixture.changed"] }, async (event) => {
      observed.push(Number(event.data.index));
      if (event.data.index === 1) {
        entered.resolve();
        await release.promise;
      } else drained.resolve();
    });
    const stopFast = events.subscribe({ types: ["fixture.changed"] }, (event) => {
      if (event.data.index === 2) independent.resolve();
    });
    try {
      for (const index of [1, 2]) {
        expect(
          events.publish(
            { type: "fixture.changed", data: { index } },
            { source: "fixture", allowUnregisteredFact: true },
          ).delivery,
        ).toBe("recorded");
      }
      expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 2 });
      await Promise.all([entered.promise, independent.promise]);
      expect(observed).toEqual([1]);
      release.resolve();
      await drained.promise;
      expect(observed).toEqual([1, 2]);
    } finally {
      release.resolve();
      stopSlow();
      stopFast();
    }
  });
  it("exposes the recorded failure on a pending Task admission link", () => {
    const { db, events } = fixture();
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample", taskId: "review/one" },
        data: { reason: "review" },
      },
      { source: "control-socket" },
    );
    createAppEventAdmissionPlan(db, {
      eventId: receipt.eventId,
      registrySnapshotId: "test",
      registryGeneration: 1,
      routes: [
        {
          appId: "sample",
          kind: "exact-task",
          routeId: "review/one",
          targetedTaskId: "review/one",
          conditionTaskIds: [],
        },
      ],
    });
    recordAppEventAdmissionCommandFailure(db, {
      eventId: receipt.eventId,
      appId: "sample",
      error: new Error("Task admission worker exceeded its deadline"),
    });
    expect(events.get(receipt.eventId)?.links).toContainEqual({
      kind: "task",
      id: "sample/review/one",
      state: "pending",
      summary: "Task admission worker exceeded its deadline",
    });
  });

  it("admits only exact fenced Task control Events", () => {
    const { bus, events } = fixture();
    bus.subscribeDurableRoute((event) =>
      event.type === "app.task.retry.requested" ? { accepted: true, by: "task-control", route: "direct" } : undefined,
    );
    expect(
      events.publish(
        {
          type: "app.task.retry.requested",
          target: { appId: "sample", taskId: "review/one" },
          data: { expectedGeneration: 2, expectedResourceVersion: 7 },
          idempotencyKey: "app-task-retry:sample:review/one:2:7",
        },
        { source: "control-socket" },
      ),
    ).toMatchObject({ eventType: "app.task.retry.requested", delivery: "accepted" });
    expect(() =>
      events.publish(
        {
          type: "app.task.cancel.requested",
          target: { appId: "sample", taskId: "review/one" },
          data: { expectedGeneration: 2, expectedResourceVersion: 0, reason: "stop" },
          idempotencyKey: "app-task-cancel:sample:review/one:2:0",
        },
        { source: "telegram" },
      ),
    ).toThrow("expectedResourceVersion must be a positive integer");
  });

  it("derives trusted envelope fields and exposes one bounded event view", () => {
    const { events } = fixture();
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample", taskId: "review/one" },
        data: { reason: "review" },
        idempotencyKey: "review-one",
      },
      { source: "control-socket" },
    );

    expect(receipt).toMatchObject({
      eventType: "project.owner.requested",
      delivery: "recorded",
    });
    expect(receipt.links).toBeUndefined();
    expect(events.get(receipt.eventId)).toMatchObject({
      event: {
        id: receipt.eventId,
        type: "project.owner.requested",
        source: "control-socket",
        owner: "app:sample",
        target: { appId: "sample", taskId: "review/one" },
        data: { appId: "sample", taskId: "review/one", reason: "review", idempotencyKey: "review-one" },
      },
      delivery: { state: "recorded" },
    });
  });

  it("accepts App input only after its durable request exists and returns the link", () => {
    const { bus, db, events } = fixture();
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "app.input.requested") return;
      const data = eventData(event);
      const created = createAppInboxItem(db, {
        appId: String(data.appId),
        source: data.source as { kind: "human"; id: string },
        input: data.input as { kind: string; data: unknown },
        originEventId: Number(event[EVENT_ROW_ID]),
        idempotencyKey: String(data.idempotencyKey),
      });
      return { accepted: true, by: `app-inbox:${created.item.id}`, route: "direct" };
    });

    const input = {
      type: "app.input.requested",
      target: { appId: "sample" },
      data: { input: { kind: "message", data: { message: "hello" } } },
      idempotencyKey: "human-turn-1",
    } as const;
    const first = events.publish(input, {
      source: "control-socket",
      inputSource: { kind: "human", id: "browser" },
    });
    const retry = events.publish(input, {
      source: "control-socket",
      inputSource: { kind: "human", id: "browser" },
    });

    expect(first).toMatchObject({
      eventType: "app.input.requested",
      delivery: "accepted",
      links: [{ kind: "request", state: "pending" }],
    });
    expect(retry).toEqual(first);
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("keeps an unaccepted required event recoverable instead of claiming acceptance", () => {
    const { bus, events } = fixture();
    const input = {
      type: "runtime.reload.requested",
      data: { reason: "test" },
      idempotencyKey: "reload-one",
    } as const;
    const receipt = events.publish(input, { source: "control-socket" });
    expect(receipt.delivery).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.state).toBe("recorded");

    bus.subscribeDurableRoute((event) => {
      if (event.type !== "runtime.reload.requested") return;
      bus.emit({
        type: "runtime.reload.finished",
        source: "runtime",
        owner: "agent:may",
        data: { ok: true, summary: "[reload] No changes" },
        trace: childEventTrace(event),
      });
      return { accepted: true, by: "command-router:runtime-reload", route: "direct" };
    });
    const recovered = events.publish(input, { source: "control-socket" });
    expect(recovered).toMatchObject({ eventId: receipt.eventId, delivery: "accepted" });
    expect(events.get(receipt.eventId)?.delivery).toMatchObject({
      state: "accepted",
      acceptedBy: "command-router:runtime-reload",
    });
    expect(events.get(receipt.eventId)?.links).toEqual([
      {
        kind: "operation",
        id: expect.stringMatching(/^event:\d+$/),
        state: "succeeded",
        summary: "[reload] No changes",
      },
    ]);
  });

  it("keeps record-only delivery recorded even when a declared route reacts", () => {
    const { bus, events } = fixture();
    bus.subscribeDurableRoute((event) =>
      event.type === "project.owner.requested"
        ? { accepted: true, by: "app-runtime:events:sample", route: "direct" }
        : undefined,
    );
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample" },
        data: { reason: "observe" },
      },
      { source: "control-socket" },
    );
    expect(receipt.delivery).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.state).toBe("recorded");
    expect(events.get(receipt.eventId)?.delivery.acceptedBy).toBeUndefined();
  });

  it("validates the record-only events exposed by HTTP controls", () => {
    const { events } = fixture();
    const inputs = [
      {
        type: "evaluation.session.requested",
        target: { appId: "sample", sessionId: "s_known" },
        data: { source: "session.jsonl", instructions: "Review this session" },
      },
      { type: "metric.threshold_changed", data: { metricId: "health", from: null, to: 2 } },
      { type: "metric.alert_resolved", data: { metricId: "health", alertId: 7, reason: "reviewed" } },
    ];

    for (const input of inputs) {
      expect(events.publish(input, { source: "control-socket" })).toMatchObject({
        eventType: input.type,
        delivery: "recorded",
      });
    }

    expect(() =>
      events.publish(
        { type: "metric.threshold_changed", data: { metricId: "health", to: Number.NaN } },
        { source: "control-socket" },
      ),
    ).toThrow("data.to must be a finite number");
  });

  it("accepts bounded ordered Task references on a Conversation view", () => {
    const { events } = fixture();
    const receipt = events.publish(
      {
        type: "conversation.message.created",
        target: { appId: "sample" },
        data: {
          conversationId: "sample:primary",
          author: { kind: "command", id: "console" },
          text: "Active work: two items",
          metadata: {
            command: "/tasks",
            taskRefs: [
              { appId: "evaluation", taskId: "review/docs" },
              { appId: "gym", taskId: "conversation-scenario" },
            ],
            followTask: { appId: "evaluation", taskId: "review/docs" },
          },
        },
      },
      { source: "control-socket" },
    );

    expect(events.get(receipt.eventId)?.event.data.metadata).toEqual({
      command: "/tasks",
      taskRefs: [
        { appId: "evaluation", taskId: "review/docs" },
        { appId: "gym", taskId: "conversation-scenario" },
      ],
      followTask: { appId: "evaluation", taskId: "review/docs" },
    });
    expect(() =>
      events.publish(
        {
          type: "conversation.message.created",
          target: { appId: "sample" },
          data: {
            conversationId: "sample:primary",
            author: { kind: "command", id: "console" },
            text: "Invalid Task view",
            metadata: { taskRefs: [{ appId: "evaluation", taskId: "" }] },
          },
        },
        { source: "control-socket" },
      ),
    ).toThrow("metadata.taskRefs");
    expect(() =>
      events.publish(
        {
          type: "conversation.message.created",
          target: { appId: "sample" },
          data: {
            conversationId: "sample:primary",
            author: { kind: "agent", id: "may" },
            text: "Invalid follow target",
            metadata: { followTask: { appId: "evaluation", taskId: "" } },
          },
        },
        { source: "control-socket" },
      ),
    ).toThrow("metadata.followTask.taskId");
  });

  it("deduplicates one semantic input across trusted adapters", () => {
    const { db, events } = fixture();
    const input = {
      type: "project.owner.requested",
      target: { appId: "sample" },
      data: { reason: "review" },
      idempotencyKey: "cross-adapter-review",
    } as const;
    const http = events.publish(input, { source: "http" });
    const socket = events.publish(input, { source: "control-socket" });

    expect(socket.eventId).toBe(http.eventId);
    expect(events.get(http.eventId)?.event.source).toBe("http");
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 1 });
  });

  it("projects copied public events without delaying publication or exposing the live bus envelope", async () => {
    const { events } = fixture();
    const observed: Array<Record<string, unknown>> = [];
    const unsubscribe = events.subscribe({ types: ["project.owner.requested"] }, (event) => {
      observed.push(event);
      event.data.reason = "mutated by listener";
      (event.data.nested as Record<string, unknown>).value = "mutated by listener";
    });
    const receipt = events.publish(
      {
        type: "project.owner.requested",
        target: { appId: "sample" },
        data: { reason: "original", nested: { value: "original" } },
      },
      { source: "control-socket" },
    );
    expect(observed).toHaveLength(0);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    unsubscribe();

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      id: receipt.eventId,
      type: "project.owner.requested",
      source: "control-socket",
      target: { appId: "sample" },
      data: { reason: "mutated by listener", nested: { value: "mutated by listener" } },
    });
    expect(Object.keys(observed[0]!).sort()).toEqual(["data", "id", "owner", "source", "target", "type"]);
    expect(events.get(receipt.eventId)?.event.data.reason).toBe("original");
    expect(events.get(receipt.eventId)?.event.data.nested).toEqual({ value: "original" });
  });

  it("rejects invalid targets and unregistered public types before persistence", () => {
    const { db, events } = fixture();
    expect(() =>
      events.publish(
        { type: "session.cancel.requested", target: { sessionId: "s_missing" }, data: {} },
        { source: "control-socket" },
      ),
    ).toThrow("Session s_missing does not exist");
    expect(() => events.publish({ type: "custom.unknown", data: {} }, { source: "control-socket" })).toThrow(
      "not admitted",
    );
    expect(() =>
      events.publish({ type: "project.approval.submitted", data: {} }, { source: "control-socket" }),
    ).toThrow("data.decision");
    expect(() =>
      events.publish(
        {
          type: "project.owner.requested",
          target: { appId: "sample", owner: "agent:forged" } as never,
          data: { reason: "test" },
        },
        { source: "control-socket" },
      ),
    ).toThrow("unsupported field 'owner'");
    expect(() =>
      events.publish(
        {
          type: "project.owner.requested",
          target: { appId: "sample" },
          data: { reason: "test" },
          source: "caller-forged",
        } as never,
        { source: "control-socket" },
      ),
    ).toThrow("Host-owned or unsupported field 'source'");
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 });
  });
});
