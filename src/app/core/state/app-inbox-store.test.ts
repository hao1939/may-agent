import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { readAppConversationResource } from "./conversations.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxHealth,
  listAppInboxItems,
  listAppInboxTaskDependencyKeys,
  releaseAppInboxClaim,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
  wakeAppInboxItemsWaitingOnApp,
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
      channelTargetId: "123",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      replyToSourceId: "telegram:123:98",
      now: 100,
    });

    expect(created.item).toMatchObject({
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelTargetId: "123",
      channelThreadId: "topic:7",
      channelMessageId: 99,
      replyToSourceId: "telegram:123:98",
      input: { kind: "message", data: { message: "hello" } },
    });
  });

  it("lets derived App work retain Conversation context without reusing a human sequence", () => {
    create("human-turn", { conversationId: "may:primary", conversationSequence: 7, now: 1 });
    const derived = createAppInboxItem(db, {
      id: "derived-work",
      appId: "may",
      source: { kind: "app", id: "may" },
      input: { kind: "goal", data: { outcome: "Review the design" } },
      conversationId: "may:primary",
      now: 2,
    });

    expect(derived.item).toMatchObject({ conversationId: "may:primary" });
    expect(derived.item.conversationSequence).toBeUndefined();
    expect(() =>
      createAppInboxItem(db, {
        appId: "may",
        source: { kind: "human", id: "human-without-sequence" },
        input: { kind: "message", data: { message: "hello" } },
        conversationId: "may:primary",
      }),
    ).toThrow("Human App inbox conversationId and conversationSequence must be provided together");
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

  it("fences agent session association and clears it when the item waits", () => {
    create("item-1", { now: 100 });
    const claim = claimAppInboxItem(db, "item-1", "worker-1", 50, 100)!;

    expect(associateAppInboxClaimSession(db, claim, "session-1", 101)).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBe("session-1");
    expect(waitAppInboxClaim(db, claim, { kind: "task", id: "task-1" }, { now: 102 })).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBeUndefined();
    expect(associateAppInboxClaimSession(db, claim, "stale-session", 103)).toBe(false);
  });

  it("ignores retained historical delivery rows after semantic completion", () => {
    createAppInboxItem(db, {
      id: "human-delivery",
      appId: "may",
      source: { kind: "human", id: "event:42" },
      input: { kind: "message", data: { text: "hello" } },
      conversationId: "may:primary",
      conversationSequence: 42,
      channel: "telegram",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "human-delivery", "worker-1", 50, 100)!;
    expect(associateAppInboxClaimSession(db, claim, "session-1", 101)).toBe(true);
    expect(completeAppInboxClaim(db, claim, { summary: "finished", response: "Hello back" }, 102)).toBe(true);
    db.run(
      `INSERT INTO app_inbox_deliveries (
         operation_id, item_id, kind, text, session_id, request_id, channel, status, created_at, updated_at
       ) VALUES (?, ?, 'final', ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        "legacy-delivery:human-delivery",
        "human-delivery",
        "Hello back",
        "session-1",
        "app-inbox-human:human-delivery",
        "telegram",
        103,
        103,
      ],
    );

    expect(getAppInboxItem(db, "human-delivery")).toMatchObject({
      status: "done",
      result: { summary: "finished", response: "Hello back" },
    });
    expect(getAppInboxItem(db, "human-delivery")).not.toHaveProperty("delivery");
    expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
      expect.objectContaining({ author: { kind: "human", id: "event:42" }, text: "hello" }),
      expect.objectContaining({ author: { kind: "agent", id: "may" }, text: "Hello back" }),
    ]);
    expect(claimAppInboxItem(db, "human-delivery", "worker-2", 50, 200)).toBeNull();
    expect(listAppInboxHealth(db, { appId: "may", now: 200 })[0]).not.toHaveProperty("waitingOnDelivery");
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

  it("returns a failed dependency review to event-driven waiting", () => {
    create("retry-wait", { now: 100 });
    const initial = claimAppInboxItem(db, "retry-wait", "worker-1", 50, 100)!;
    expect(
      waitAppInboxClaim(db, initial, { kind: "session", id: "session-old" }, { reviewAfterMs: 100, now: 110 }),
    ).toBe(true);
    const review = claimAppInboxItem(db, "retry-wait", "worker-2", 50, 210)!;

    expect(releaseAppInboxClaim(db, review, { retryAfterMs: 1, now: 211 })).toBe(true);
    expect(getAppInboxItem(db, "retry-wait")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "session", id: "session-old" },
      availableAt: undefined,
      reviewAt: undefined,
    });
    expect(claimAppInboxItem(db, "retry-wait", "worker-3", 50, 10_000)).toBeNull();

    expect(wakeAppInboxItemsWaitingOn(db, { kind: "session", id: "session-old" }, 10_001)).toBe(1);
    expect(claimAppInboxItem(db, "retry-wait", "worker-3", 50, 10_001)).not.toBeNull();
  });

  it("deduplicates Task recovery keys and scopes a wake to the canonical App", () => {
    const waitForTask = (id: string, appId: string) => {
      createAppInboxItem(db, {
        id,
        appId,
        source: { kind: "system", id: "test" },
        input: { kind: "message", data: { text: id } },
        now: 100,
      });
      const claim = claimAppInboxItem(db, id, `worker:${appId}`, 50, 101)!;
      expect(waitAppInboxClaim(db, claim, { kind: "task", id: "runtime/owner-review" }, { now: 102 })).toBe(true);
    };
    waitForTask("evaluation-1", "evaluation");
    waitForTask("evaluation-2", "evaluation");
    waitForTask("aks-1", "alpha-project");

    const first = listAppInboxTaskDependencyKeys(db, { limit: 1 });
    expect(first).toEqual({
      items: [{ appId: "alpha-project", taskId: "runtime/owner-review" }],
      nextCursor: { appId: "alpha-project", taskId: "runtime/owner-review" },
    });
    expect(listAppInboxTaskDependencyKeys(db, { after: first.nextCursor, limit: 1 })).toEqual({
      items: [{ appId: "evaluation", taskId: "runtime/owner-review" }],
    });

    expect(wakeAppInboxItemsWaitingOnApp(db, "evaluation", { kind: "task", id: "runtime/owner-review" }, 120)).toBe(2);
    expect(getAppInboxItem(db, "evaluation-1")?.availableAt).toBe(120);
    expect(getAppInboxItem(db, "evaluation-2")?.availableAt).toBe(120);
    expect(getAppInboxItem(db, "aks-1")?.availableAt).toBeUndefined();
  });

  it("fences session association and waits by the exact claim generation", () => {
    create("session-fence", { now: 100 });
    const stale = claimAppInboxItem(db, "session-fence", "old-runtime", 10, 100)!;
    expect(associateAppInboxClaimSession(db, stale, "session-old", 101)).toBe(true);
    expect(getAppInboxItem(db, "session-fence")).toMatchObject({
      sessionId: "session-old",
      lease: { generation: 1, owner: "old-runtime" },
    });

    const current = claimAppInboxItem(db, "session-fence", "new-runtime", 50, 111)!;
    expect(waitAppInboxClaim(db, stale, { kind: "session", id: "session-old" }, { now: 112 })).toBe(false);
    expect(associateAppInboxClaimSession(db, current, "session-current", 113)).toBe(true);
    expect(waitAppInboxClaim(db, current, { kind: "session", id: "session-current" }, { now: 114 })).toBe(true);

    expect(getAppInboxItem(db, "session-fence")).toMatchObject({
      id: "session-fence",
      waitingOn: { kind: "session", id: "session-current" },
      lease: undefined,
    });
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
