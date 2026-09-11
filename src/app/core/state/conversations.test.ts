import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import {
  createAppInboxItem,
  claimAppInboxItem,
  completeAppInboxClaim,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
} from "./app-inbox-store.js";
import {
  createConversationTopic,
  findConversationTopics,
  readAppConversationResource,
  listConversationTopicPage,
  readConversationMessageTopicId,
  readConversationTopic,
} from "./conversations.js";

describe("Conversation store", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

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

  it("pages Topics and resolves an exact old Topic and its message outside the recent window", () => {
    for (let index = 0; index < 15; index += 1) {
      const ref = index.toString(16).padStart(8, "0");
      createConversationTopic(db, {
        id: `topic_${ref}abcdef0123456789`,
        appId: "may",
        conversationId: "may:primary",
        title: `Topic ${index}`,
        openedBy: "human",
        originMessageId: `human:${index}`,
        now: 100 + index,
      });
    }
    createAppInboxItem(db, {
      id: "old-topic-turn",
      appId: "may",
      topicId: "topic_00000000abcdef0123456789",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "human:old-topic" },
      input: { kind: "message", data: { message: "the old terminal design" } },
      now: 1,
    });

    const first = listConversationTopicPage(db, "may", "may:primary", { limit: 5 });
    const second = listConversationTopicPage(db, "may", "may:primary", {
      limit: 5,
      cursor: first.nextCursor,
    });

    expect(first.items.map((topic) => topic.title)).toEqual([
      "Topic 14",
      "Topic 13",
      "Topic 12",
      "Topic 11",
      "Topic 10",
    ]);
    expect(second.items.map((topic) => topic.title)).toEqual(["Topic 9", "Topic 8", "Topic 7", "Topic 6", "Topic 5"]);
    expect(readConversationTopic(db, "may", "may:primary", "00000000")?.title).toBe("Topic 0");
    expect(findConversationTopics(db, "may", "may:primary", "terminal design")).toMatchObject([{ title: "Topic 0" }]);
    expect(readConversationMessageTopicId(db, "may", "may:primary", "human:old-topic")).toBe(
      "topic_00000000abcdef0123456789",
    );
    const exact = readAppConversationResource(db, "may", "may:primary", { topicId: "00000000" });
    expect(exact.topics?.[0]).toMatchObject({ title: "Topic 0" });
    expect(exact.messages).toContainEqual(
      expect.objectContaining({ id: "human:old-topic", text: "the old terminal design" }),
    );
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

  it("uses an explicitly published response as the one canonical Conversation message", () => {
    createAppInboxItem(db, {
      id: "request-with-message",
      appId: "may",
      source: { kind: "human", id: "human:request-with-message" },
      input: { kind: "message", data: { message: "apply it" } },
      conversationId: "may:primary",
      conversationSequence: 100,
      channel: "may-console",
      now: 100,
    });
    const claim = claimAppInboxItem(db, "request-with-message", "worker", 1_000, 101)!;
    expect(
      completeAppInboxClaim(
        db,
        claim,
        { summary: "Applied the proposal", response: "I’m applying the additive first stage." },
        102,
      ),
    ).toBe(true);
    db.run(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (1000, 'conversation.message.created', 'app-inbox', 'app:may', ?, 103)`,
      [
        JSON.stringify({
          appId: "may",
          conversationId: "may:primary",
          messageId: "result:request-with-message",
          author: { kind: "agent", id: "may" },
          text: "I’m applying the additive first stage.",
          metadata: { channel: "may-console", requestId: "request-with-message" },
        }),
      ],
    );

    const agentMessages = readAppConversationResource(db, "may", "may:primary").messages.filter(
      (message) => message.author.kind === "agent",
    );
    expect(agentMessages).toEqual([
      expect.objectContaining({
        id: "result:request-with-message",
        text: "I’m applying the additive first stage.",
        metadata: expect.objectContaining({ requestId: "request-with-message" }),
      }),
    ]);
  });

  it("keeps one response identity when explicit and fallback rows fall into different bounded windows", () => {
    createAppInboxItem(db, {
      id: "bounded-request",
      appId: "may",
      source: { kind: "human", id: "human:bounded-request" },
      input: { kind: "message", data: { message: "show the result once" } },
      conversationId: "may:primary",
      conversationSequence: 100,
      now: 100,
    });
    const claim = claimAppInboxItem(db, "bounded-request", "worker", 1_000, 101)!;
    expect(
      completeAppInboxClaim(db, claim, { summary: "One stable response", response: "One stable response" }, 102),
    ).toBe(true);
    const insert = db.prepare(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', 'app-inbox', 'app:may', ?, ?)`,
    );
    insert.run(
      1000,
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        messageId: "result:bounded-request",
        author: { kind: "agent", id: "may" },
        text: "One stable response",
        metadata: { requestId: "bounded-request" },
      }),
      103,
    );

    expect(readAppConversationResource(db, "may", "may:primary", { limit: 2 }).messages.at(-1)).toMatchObject({
      id: "result:bounded-request",
      sequence: 1000,
      text: "One stable response",
    });

    // Transient rows are intentionally absent from Conversation context, but
    // still consume the bounded Event query. They push the explicit row out
    // while the compatibility inbox projection remains in its own window.
    for (const id of [1001, 1002]) {
      insert.run(
        id,
        JSON.stringify({
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "tool", id: "runtime" },
          text: `transient ${id}`,
          transient: true,
        }),
        103 + id,
      );
    }

    expect(readAppConversationResource(db, "may", "may:primary", { limit: 2 }).messages.at(-1)).toMatchObject({
      id: "result:bounded-request",
      sequence: 100,
      text: "One stable response",
    });
  });
});
