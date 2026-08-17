import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  claimNextAppInboxDelivery,
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxAssociatedSessionClaims,
  listAppInboxHealth,
  listAppInboxDeliveries,
  listAppConversationTurns,
  listAppInboxItems,
  listAppInboxSessionWaits,
  markAppInboxSendingDeliveriesUncertain,
  recordAppInboxDeliveryReceipt,
  restoreReplayableAppInboxDeliveries,
  stageAppInboxClaimDelivery,
  stageAppInboxProgressDelivery,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
} from "./app-inbox-store.js";

describe("App inbox store", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

  function create(id: string, options: { conversationId?: string; conversationSequence?: number; now?: number } = {}) {
    return createAppInboxItem(db, {
      id,
      appId: "may",
      source: { kind: "human", id: "user-1" },
      input: { kind: "message", data: { text: id } },
      ...options,
    }).item;
  }

  it("creates identical input idempotently within an App", () => {
    const first = createAppInboxItem(db, {
      id: "first-id",
      appId: "may",
      source: { kind: "human", id: "user-1" },
      input: { kind: "message", data: { text: "hello" } },
      idempotencyKey: "telegram:42",
      now: 100,
    });
    const duplicate = createAppInboxItem(db, {
      id: "second-id",
      appId: "may",
      source: { kind: "human", id: "user-1" },
      input: { kind: "message", data: { text: "hello" } },
      idempotencyKey: "telegram:42",
      now: 200,
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.item.id).toBe("first-id");
    expect(duplicate.item.input.data).toEqual({ text: "hello" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("rejects an idempotency key reused with different App input", () => {
    createAppInboxItem(db, {
      appId: "may",
      source: { kind: "human", id: "user-1" },
      input: { kind: "message", data: { text: "first" } },
      idempotencyKey: "telegram:conflict",
    });

    expect(() =>
      createAppInboxItem(db, {
        appId: "may",
        source: { kind: "human", id: "user-1" },
        input: { kind: "message", data: { text: "different" } },
        idempotencyKey: "telegram:conflict",
      }),
    ).toThrow("reused with different input");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  });

  it("preserves channel reply metadata outside the App-authored input", () => {
    const created = createAppInboxItem(db, {
      id: "human-message",
      appId: "may",
      source: { kind: "human", id: "event:42" },
      input: { kind: "message", data: { message: "hello" } },
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      replyToSourceId: "telegram:123:98",
      now: 100,
    });

    expect(created.item).toMatchObject({
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      replyToSourceId: "telegram:123:98",
      input: { kind: "message", data: { message: "hello" } },
    });
  });

  it("derives a conversation from requests, exact reply links, and deliveries", () => {
    createAppInboxItem(db, {
      id: "conversation-turn",
      appId: "may",
      source: { kind: "human", id: "telegram:123:11" },
      input: { kind: "message", data: { message: "continue" } },
      conversationId: "telegram:123",
      conversationSequence: 11,
      channel: "telegram",
      channelMessageId: 11,
      replyToSourceId: "telegram:123:10",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "conversation-turn", "worker", 50, 100)!;
    associateAppInboxClaimSession(db, claim, "session-conversation", 101);
    const delivery = stageAppInboxClaimDelivery(
      db,
      claim,
      {
        channel: "telegram",
        sessionId: "session-conversation",
        requestId: "app-inbox-human:conversation-turn",
        result: { summary: "done", response: "Continued." },
      },
      102,
    );

    expect(listAppConversationTurns(db, "may", "telegram:123")).toEqual([
      {
        requestId: "conversation-turn",
        sourceId: "telegram:123:11",
        replyToSourceId: "telegram:123:10",
        input: { kind: "message", data: { message: "continue" } },
        state: "working",
        deliveries: [
          expect.objectContaining({
            operationId: delivery.operationId,
            kind: "final",
            text: "Continued.",
            status: "pending",
          }),
        ],
      },
    ]);
  });

  it("does not treat a cross-App id collision as an idempotent create", () => {
    create("shared-id", { now: 100 });

    expect(() =>
      createAppInboxItem(db, {
        id: "shared-id",
        appId: "evaluation",
        source: { kind: "system", id: "canary" },
        input: { kind: "probe", data: {} },
        now: 101,
      }),
    ).toThrow("already belongs to App may");
  });

  it("does not duplicate a claim while its lease is valid", () => {
    create("item-1", { now: 100 });

    const first = claimAppInboxItem(db, "item-1", "worker-1", 50, 100);

    expect(first?.generation).toBe(1);
    expect(claimAppInboxItem(db, "item-1", "worker-2", 50, 149)).toBeNull();
    expect(claimNextAppInboxItem(db, "may", "worker-2", 50, 149)).toBeNull();
  });

  it("queries the authoritative inbox projection without decoding events", () => {
    create("older", { now: 100 });
    create("newer", { now: 101 });
    const claim = claimAppInboxItem(db, "older", "worker-1", 50, 110)!;
    completeAppInboxClaim(db, claim, { summary: "done" }, 120);

    expect(listAppInboxItems(db, { appId: "may" }).map((item) => item.id)).toEqual(["newer", "older"]);
    expect(listAppInboxItems(db, { appId: "may", status: "done" })).toMatchObject([
      { id: "older", result: { summary: "done" } },
    ]);
  });

  it("projects current inbox health without reconstructing lifecycle events", () => {
    create("pending", { now: 100 });
    create("leased", { now: 110 });
    create("waiting", { now: 120 });
    expect(claimAppInboxItem(db, "leased", "worker-1", 50, 130)).not.toBeNull();
    const waiting = claimAppInboxItem(db, "waiting", "worker-2", 100, 130)!;
    expect(waitAppInboxClaim(db, waiting, { kind: "task", id: "task-1" }, { now: 140 })).toBe(true);
    createAppInboxItem(db, {
      id: "evaluation-done",
      appId: "evaluation",
      source: { kind: "system", id: "canary" },
      input: { kind: "probe", data: {} },
      now: 150,
    });
    const evaluation = claimAppInboxItem(db, "evaluation-done", "worker-3", 50, 150)!;
    completeAppInboxClaim(db, evaluation, { summary: "done" }, 160);

    expect(listAppInboxHealth(db, { appId: "may", now: 181 })).toEqual([
      {
        appId: "may",
        total: 3,
        pending: 1,
        handling: 2,
        done: 0,
        ready: 2,
        waitingOnDependency: 1,
        waitingOnDelivery: 0,
        activeLeases: 0,
        expiredLeases: 1,
        oldestPendingAgeMs: 81,
        oldestHandlingItemAgeMs: 71,
      },
    ]);
    expect(listAppInboxHealth(db, { now: 181 }).map((entry) => entry.appId)).toEqual(["evaluation", "may"]);
  });

  it("reclaims an expired lease and fences the stale generation", () => {
    create("item-1", { now: 100 });
    const stale = claimAppInboxItem(db, "item-1", "worker-1", 50, 100)!;

    const replacement = claimAppInboxItem(db, "item-1", "worker-2", 50, 150)!;

    expect(replacement.generation).toBe(2);
    expect(completeAppInboxClaim(db, stale, { summary: "stale" }, 151)).toBe(false);
    expect(completeAppInboxClaim(db, replacement, { summary: "finished" }, 152)).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.result).toEqual({ summary: "finished" });
  });

  it("fences owner session association and clears it when the item waits", () => {
    create("item-1", { now: 100 });
    const claim = claimAppInboxItem(db, "item-1", "worker-1", 50, 100)!;

    expect(associateAppInboxClaimSession(db, claim, "session-1", 101)).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBe("session-1");
    expect(waitAppInboxClaim(db, claim, { kind: "task", id: "task-1" }, { now: 102 })).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBeUndefined();
    expect(associateAppInboxClaimSession(db, claim, "stale-session", 103)).toBe(false);
  });

  it("holds an admitted human result until the exact delivery is proved", () => {
    createAppInboxItem(db, {
      id: "human-delivery",
      appId: "may",
      source: { kind: "human", id: "event:42" },
      input: { kind: "message", data: { text: "hello" } },
      channel: "telegram",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "human-delivery", "worker-1", 50, 100)!;
    expect(associateAppInboxClaimSession(db, claim, "session-1", 101)).toBe(true);
    const delivery = stageAppInboxClaimDelivery(
      db,
      claim,
      {
        channel: "telegram",
        sessionId: "session-1",
        requestId: "app-inbox-human:human-delivery",
        result: { summary: "finished", response: "Hello back" },
      },
      102,
    );

    expect(delivery.status).toBe("pending");
    expect(getAppInboxItem(db, "human-delivery")).toMatchObject({
      status: "handling",
      result: { summary: "finished", response: "Hello back" },
      delivery: { status: "pending" },
    });
    expect(claimAppInboxItem(db, "human-delivery", "worker-2", 50, 200)).toBeNull();
    expect(listAppInboxHealth(db, { appId: "may", now: 200 })[0]?.waitingOnDelivery).toBe(1);

    const dispatch = claimNextAppInboxDelivery(db, 103)!;
    expect(dispatch).toMatchObject({
      text: "Hello back",
      delivery: { status: "sending", operationId: delivery.operationId },
    });
    expect(
      recordAppInboxDeliveryReceipt(
        db,
        {
          operationId: delivery.operationId,
          itemId: "different-item",
          sessionId: "session-1",
          requestId: "app-inbox-human:human-delivery",
          channel: "telegram",
          status: "delivered",
        },
        104,
      ),
    ).toEqual({ matched: false, completed: false });
    expect(
      recordAppInboxDeliveryReceipt(
        db,
        {
          operationId: delivery.operationId,
          itemId: "human-delivery",
          sessionId: "session-1",
          requestId: "app-inbox-human:human-delivery",
          channel: "telegram",
          status: "uncertain",
          reason: "request outcome unknown",
        },
        105,
      ),
    ).toEqual({ matched: true, completed: false, status: "uncertain" });
    expect(claimNextAppInboxDelivery(db, 106)).toBeNull();
    expect(getAppInboxItem(db, "human-delivery")).toMatchObject({
      status: "handling",
      delivery: { status: "uncertain", failureReason: "request outcome unknown" },
    });

    expect(
      recordAppInboxDeliveryReceipt(
        db,
        {
          operationId: delivery.operationId,
          itemId: "human-delivery",
          sessionId: "session-1",
          requestId: "app-inbox-human:human-delivery",
          channel: "telegram",
          status: "delivered",
          externalMessageId: "700",
        },
        107,
      ),
    ).toEqual({ matched: true, completed: true, status: "delivered" });
    expect(getAppInboxItem(db, "human-delivery")).toMatchObject({
      status: "done",
      delivery: { status: "delivered", externalMessageId: "700" },
    });
  });

  it("delivers durable progress without completing the request", () => {
    createAppInboxItem(db, {
      id: "human-progress",
      appId: "may",
      source: { kind: "human", id: "telegram:42" },
      input: { kind: "message", data: { text: "please inspect" } },
      channel: "telegram",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "human-progress", "worker-1", 50, 100)!;
    expect(associateAppInboxClaimSession(db, claim, "session-progress", 101)).toBe(true);
    expect(waitAppInboxClaim(db, claim, { kind: "analysis", id: "analysis-1" }, { now: 102 })).toBe(true);
    const progress = stageAppInboxProgressDelivery(
      db,
      {
        itemId: "human-progress",
        operationId: "app-progress:human-progress:analysis-1",
        channel: "telegram",
        sessionId: "session-progress",
        requestId: "app-inbox-human:human-progress",
        text: "I’ll inspect this and return with the evidence.",
      },
      102,
    );
    // Retrying the same admitted analysis stages no duplicate message.
    expect(
      stageAppInboxProgressDelivery(
        db,
        {
          itemId: "human-progress",
          operationId: progress.operationId,
          channel: "telegram",
          sessionId: "session-progress",
          requestId: "app-inbox-human:human-progress",
          text: "I’ll inspect this and return with the evidence.",
        },
        103,
      ).operationId,
    ).toBe(progress.operationId);

    const dispatch = claimNextAppInboxDelivery(db, 104)!;
    expect(dispatch).toMatchObject({
      text: "I’ll inspect this and return with the evidence.",
      delivery: { kind: "progress", operationId: progress.operationId },
    });
    expect(
      recordAppInboxDeliveryReceipt(
        db,
        {
          operationId: progress.operationId,
          itemId: "human-progress",
          sessionId: "session-progress",
          requestId: "app-inbox-human:human-progress",
          channel: "telegram",
          status: "delivered",
        },
        105,
      ),
    ).toEqual({ matched: true, completed: false, status: "delivered" });
    expect(getAppInboxItem(db, "human-progress")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "analysis", id: "analysis-1" },
    });
    expect(listAppInboxDeliveries(db, "human-progress")).toMatchObject([
      { kind: "progress", status: "delivered", text: "I’ll inspect this and return with the evidence." },
    ]);
  });

  it("preserves a definite delivery failure for review without redispatch", () => {
    createAppInboxItem(db, {
      id: "failed-delivery",
      appId: "may",
      source: { kind: "human", id: "event:43" },
      input: { kind: "message", data: { text: "hello" } },
      channel: "web-ui",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "failed-delivery", "worker-1", 50, 100)!;
    associateAppInboxClaimSession(db, claim, "session-2", 101);
    const delivery = stageAppInboxClaimDelivery(
      db,
      claim,
      {
        channel: "web-ui",
        sessionId: "session-2",
        requestId: "app-inbox-human:failed-delivery",
        result: { summary: "finished" },
      },
      102,
    );
    expect(claimNextAppInboxDelivery(db, 103)).not.toBeNull();

    expect(
      recordAppInboxDeliveryReceipt(
        db,
        {
          operationId: delivery.operationId,
          itemId: "failed-delivery",
          sessionId: "session-2",
          requestId: "app-inbox-human:failed-delivery",
          channel: "web-ui",
          status: "failed",
          reason: "no connected browser",
        },
        104,
      ),
    ).toEqual({ matched: true, completed: false, status: "failed" });
    expect(claimNextAppInboxDelivery(db, 1_000)).toBeNull();
    expect(getAppInboxItem(db, "failed-delivery")).toMatchObject({
      status: "handling",
      result: { summary: "finished" },
      delivery: { status: "failed", failureReason: "no connected browser" },
    });
  });

  it("replays only idempotent internal deliveries after restart", () => {
    for (const [id, channel] of [
      ["internal-delivery", "agent:evaluator"],
      ["external-delivery", "telegram"],
    ] as const) {
      createAppInboxItem(db, {
        id,
        appId: "may",
        source: { kind: "system", id: `event:${id}` },
        input: { kind: "message", data: { message: id } },
        channel,
        now: 100,
      });
      const claim = claimAppInboxItem(db, id, "worker-1", 50, 100)!;
      associateAppInboxClaimSession(db, claim, `session:${id}`, 101);
      stageAppInboxClaimDelivery(
        db,
        claim,
        {
          channel,
          sessionId: `session:${id}`,
          requestId: `request:${id}`,
          result: { summary: `${id} result` },
        },
        102,
      );
      expect(claimNextAppInboxDelivery(db, 103)).not.toBeNull();
    }

    expect(restoreReplayableAppInboxDeliveries(db, 200)).toBe(1);
    expect(markAppInboxSendingDeliveriesUncertain(db, 200)).toBe(1);
    expect(getAppInboxItem(db, "internal-delivery")?.delivery).toMatchObject({
      channel: "agent:evaluator",
      status: "pending",
    });
    expect(getAppInboxItem(db, "external-delivery")?.delivery).toMatchObject({
      channel: "telegram",
      status: "uncertain",
    });
  });

  it("wakes dependency waits and also requeues them at review time", () => {
    create("wake-me", { now: 100 });
    create("review-me", { now: 100 });
    const wakeClaim = claimAppInboxItem(db, "wake-me", "worker-1", 50, 100)!;
    const reviewClaim = claimAppInboxItem(db, "review-me", "worker-2", 50, 100)!;

    expect(waitAppInboxClaim(db, wakeClaim, { kind: "app", id: "child-1" }, { now: 110 })).toBe(true);
    expect(waitAppInboxClaim(db, reviewClaim, { kind: "task", id: "task-1" }, { reviewAfterMs: 100, now: 110 })).toBe(
      true,
    );
    expect(claimAppInboxItem(db, "review-me", "worker-3", 50, 209)).toBeNull();

    expect(wakeAppInboxItemsWaitingOn(db, { kind: "app", id: "child-1" }, 120)).toBe(1);
    expect(wakeAppInboxItemsWaitingOn(db, { kind: "app", id: "child-1" }, 120)).toBe(0);
    expect(wakeAppInboxItemsWaitingOn(db, { kind: "app", id: "unrelated-child" }, 120)).toBe(0);
    expect(claimAppInboxItem(db, "wake-me", "worker-3", 50, 120)?.generation).toBe(2);
    expect(claimAppInboxItem(db, "review-me", "worker-4", 50, 210)?.generation).toBe(2);
  });

  it("fences recovered session waits by the exact claim generation", () => {
    create("session-fence", { now: 100 });
    const stale = claimAppInboxItem(db, "session-fence", "old-runtime", 10, 100)!;
    expect(associateAppInboxClaimSession(db, stale, "session-old", 101)).toBe(true);
    expect(listAppInboxAssociatedSessionClaims(db)).toMatchObject([
      {
        sessionId: "session-old",
        claim: { generation: 1, owner: "old-runtime", item: { id: "session-fence" } },
      },
    ]);

    const current = claimAppInboxItem(db, "session-fence", "new-runtime", 50, 111)!;
    expect(waitAppInboxClaim(db, stale, { kind: "session", id: "session-old" }, { now: 112 })).toBe(false);
    expect(associateAppInboxClaimSession(db, current, "session-current", 113)).toBe(true);
    expect(waitAppInboxClaim(db, current, { kind: "session", id: "session-current" }, { now: 114 })).toBe(true);

    expect(listAppInboxSessionWaits(db)).toMatchObject([
      {
        id: "session-fence",
        waitingOn: { kind: "session", id: "session-current" },
        lease: undefined,
      },
    ]);
  });

  it("admits and completes unrelated items independently", () => {
    create("item-1", { now: 100 });
    create("item-2", { now: 101 });

    const first = claimNextAppInboxItem(db, "may", "worker-1", 50, 110)!;
    const second = claimNextAppInboxItem(db, "may", "worker-2", 50, 110)!;

    expect(first.item.id).toBe("item-1");
    expect(second.item.id).toBe("item-2");
    expect(completeAppInboxClaim(db, first, { summary: "first" }, 120)).toBe(true);
    expect(getAppInboxItem(db, "item-2")?.status).toBe("handling");
    expect(completeAppInboxClaim(db, second, { summary: "second" }, 121)).toBe(true);
  });

  it("serializes active conversation attempts without blocking on dependency waits", () => {
    create("turn-1", { conversationId: "chat-1", conversationSequence: 1, now: 100 });
    create("turn-2", { conversationId: "chat-1", conversationSequence: 2, now: 101 });

    const first = claimNextAppInboxItem(db, "may", "worker-1", 50, 110)!;

    expect(first.item.id).toBe("turn-1");
    expect(claimNextAppInboxItem(db, "may", "worker-2", 50, 110)).toBeNull();
    expect(claimAppInboxItem(db, "turn-2", "worker-2", 50, 110)).toBeNull();
    expect(waitAppInboxClaim(db, first, { kind: "app", id: "child-1" }, { now: 120 })).toBe(true);
    expect(claimNextAppInboxItem(db, "may", "worker-2", 50, 120)?.item.id).toBe("turn-2");
  });
});
