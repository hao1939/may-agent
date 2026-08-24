import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxAssociatedSessionClaims,
  listAppInboxHealth,
  listAppInboxDeliveries,
  listAppInboxItems,
  listAppInboxSessionWaits,
  listAppInboxTaskDependencyKeys,
  releaseAppInboxClaim,
  readAppConversationResource,
  renewAppInboxClaim,
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

  it("projects one conversation resource and excludes transient events from context", () => {
    createAppInboxItem(db, {
      id: "human-1",
      appId: "may",
      source: { kind: "human", id: "console:1" },
      input: { kind: "message", data: { message: "show my work" } },
      conversationId: "may:primary",
      conversationSequence: 10,
      channel: "may-console",
      originEventId: 10,
      now: 100,
    });
    const insert = db.prepare(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', ?, 'app:may', ?, ?)`,
    );
    insert.run(
      11,
      "may-console",
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "command", id: "may-console" },
        text: "Active work: 1 item",
        metadata: {
          channel: "may-console",
          command: "/tasks",
          taskRefs: [{ appId: "evaluation", taskId: "review/docs" }],
          followTask: { appId: "evaluation", taskId: "review/docs" },
        },
      }),
      110,
    );
    insert.run(
      12,
      "runtime",
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "tool", id: "progress" },
        text: "50%",
        transient: true,
        metadata: { channel: "may-console" },
      }),
      120,
    );
    insert.run(
      13,
      "other-app",
      JSON.stringify({
        appId: "other",
        conversationId: "may:primary",
        author: { kind: "command", id: "other-app" },
        text: "Must stay outside May's conversation",
      }),
      130,
    );

    expect(readAppConversationResource(db, "may", "may:primary")).toMatchObject({
      id: "may:primary",
      owner: "may",
      version: 11,
      messages: [
        { id: "console:1", sequence: 10, author: { kind: "human", id: "console:1" }, text: "show my work" },
        {
          id: "event:11",
          sequence: 11,
          author: { kind: "command", id: "may-console" },
          text: "Active work: 1 item",
          metadata: {
            channel: "may-console",
            command: "/tasks",
            taskRefs: [
              {
                appId: "evaluation",
                taskId: "review/docs",
                ref: expect.stringMatching(/^[0-9a-f]{8}$/),
              },
            ],
            followTask: {
              appId: "evaluation",
              taskId: "review/docs",
              ref: expect.stringMatching(/^[0-9a-f]{8}$/),
            },
          },
        },
      ],
    });
    expect(readAppConversationResource(db, "may", "may:primary")).toMatchObject({
      messages: [{ id: "console:1" }, { id: "event:11" }],
    });
  });

  it("projects only the latest durable command view per adapter surface", () => {
    createAppInboxItem(db, {
      id: "human-command-context",
      appId: "may",
      source: { kind: "human", id: "console:context" },
      input: { kind: "message", data: { message: "what did I just see?" } },
      conversationId: "may:primary",
      conversationSequence: 20,
      originEventId: 20,
      now: 200,
    });
    const insert = db.prepare(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', ?, 'app:may', ?, ?)`,
    );
    const command = (channel: string, text: string, commandText: string, target?: string) =>
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "command", id: channel },
        text,
        metadata: {
          channel,
          ...(target ? { channelTargetId: target } : {}),
          command: commandText,
        },
      });
    insert.run(21, "may-console", command("may-console", "stale Console view", "/tasks"), 210);
    insert.run(22, "telegram", command("telegram", "Telegram view", "/apps", "123"), 220);
    insert.run(23, "may-console", command("may-console", "current Console view", "/task abcdef12"), 230);

    expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
      expect.objectContaining({ id: "console:context", author: { kind: "human", id: "console:context" } }),
      expect.objectContaining({ id: "event:22", text: "Telegram view" }),
      expect.objectContaining({ id: "event:23", text: "current Console view" }),
    ]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 3 });
  });

  it("reconstructs the same Conversation resource after reopening durable state", () => {
    const root = mkdtempSync(join(tmpdir(), "may-conversation-restart-"));
    const path = join(root, "state.db");
    let persistentDb = openDatabase(path);
    try {
      applyDbSchema(persistentDb);
      createAppInboxItem(persistentDb, {
        id: "human-restart",
        appId: "may",
        source: { kind: "human", id: "console:restart:1" },
        input: { kind: "message", data: { message: "remember this" } },
        conversationId: "may:primary",
        conversationSequence: 21,
        channel: "may-console",
        originEventId: 21,
        now: 100,
      });
      persistentDb.run(
        `INSERT INTO events (id, event_type, source, owner, data, timestamp)
         VALUES (?, 'conversation.message.created', 'telegram', 'app:may', ?, ?)`,
        [
          22,
          JSON.stringify({
            appId: "may",
            conversationId: "may:primary",
            author: { kind: "command", id: "telegram" },
            text: "Active Tasks: remember this — pending",
            metadata: { channel: "telegram", command: "/tasks" },
          }),
          110,
        ],
      );
      const before = readAppConversationResource(persistentDb, "may", "may:primary");

      persistentDb.close();
      persistentDb = openDatabase(path);
      applyDbSchema(persistentDb);

      expect(readAppConversationResource(persistentDb, "may", "may:primary")).toEqual(before);
    } finally {
      persistentDb.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("projects one Task result for several human turns targeting that Task", () => {
    const taskId = "conversation/request-1";
    const inputs = [
      { id: "request-1", targetTaskId: undefined, now: 100 },
      { id: "request-2", targetTaskId: taskId, now: 110 },
      { id: "request-3", targetTaskId: taskId, now: 120 },
    ];
    for (const input of inputs) {
      createAppInboxItem(db, {
        id: input.id,
        appId: "may",
        source: { kind: "human", id: `human:${input.id}` },
        input: { kind: "message", data: { message: input.id } },
        conversationId: "may:primary",
        conversationSequence: input.now,
        ...(input.targetTaskId ? { targetTaskId: input.targetTaskId } : {}),
        now: input.now,
      });
      const claim = claimAppInboxItem(db, input.id, "worker", 1_000, input.now + 1);
      if (!claim) throw new Error(`expected claim for ${input.id}`);
      expect(waitAppInboxClaim(db, claim, { kind: "task", id: taskId }, { now: input.now + 2 })).toBe(true);
    }
    expect(wakeAppInboxItemsWaitingOn(db, { kind: "task", id: taskId }, 200)).toBe(3);
    for (const input of inputs) {
      const claim = claimAppInboxItem(db, input.id, "worker", 1_000, 201);
      if (!claim) throw new Error(`expected completion claim for ${input.id}`);
      expect(completeAppInboxClaim(db, claim, { summary: "The Task is finished" }, 202)).toBe(true);
    }

    const messages = readAppConversationResource(db, "may", "may:primary").messages;
    expect(messages.filter((message) => message.author.kind === "human")).toHaveLength(3);
    expect(messages.filter((message) => message.author.kind === "agent")).toEqual([
      expect.objectContaining({ id: "result:request-3", text: "The Task is finished" }),
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

  it("fences agent session association and clears it when the item waits", () => {
    create("item-1", { now: 100 });
    const claim = claimAppInboxItem(db, "item-1", "worker-1", 50, 100)!;

    expect(associateAppInboxClaimSession(db, claim, "session-1", 101)).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBe("session-1");
    expect(waitAppInboxClaim(db, claim, { kind: "task", id: "task-1" }, { now: 102 })).toBe(true);
    expect(getAppInboxItem(db, "item-1")?.sessionId).toBeUndefined();
    expect(associateAppInboxClaimSession(db, claim, "stale-session", 103)).toBe(false);
  });

  it("keeps historical delivery evidence read-only after semantic completion", () => {
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
      delivery: { status: "pending" },
    });
    expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
      expect.objectContaining({ author: { kind: "human", id: "event:42" }, text: "hello" }),
      expect.objectContaining({ author: { kind: "agent", id: "may" }, text: "Hello back" }),
    ]);
    expect(claimAppInboxItem(db, "human-delivery", "worker-2", 50, 200)).toBeNull();
    expect(listAppInboxHealth(db, { appId: "may", now: 200 })[0]?.waitingOnDelivery).toBe(0);
    expect(listAppInboxDeliveries(db, "human-delivery")).toMatchObject([
      { kind: "final", status: "pending", text: "Hello back" },
    ]);
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
