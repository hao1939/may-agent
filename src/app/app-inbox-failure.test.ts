import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppRequestDecision } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { AppInboxHost } from "./app-inbox-host.js";
import {
  createConversationTopic,
  linkConversationTopicTask,
  readAppConversationResource,
} from "./core/state/conversations.js";

const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
  requests: { mode: "agent" },
});
const owner = defineApp({
  id: "owner",
  version: 1,
  agent: "owner",
  inputSchema: Type.Object({ kind: Type.Literal("work"), data: Type.Object({}) }),
  tasks: {},
  task: () => ({ kind: "existing", taskId: "work" }),
});
const answer: AppRequestDecision = { summary: "Answered", response: "Verified answer", topic: { kind: "none" } };
const roots: string[] = [];
const connections: SqliteDb[] = [];
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-input-failure-"));
  roots.push(root);
  const path = join(root, "host.sqlite");
  const open = () => {
    const db = openDatabase(path);
    applyDbSchema(db);
    connections.push(db);
    return db;
  };
  return { open, db: open() };
}
function admit(host: AppInboxHost, id = "first", sequence = 1) {
  host.admit({
    id,
    appId: app.id,
    conversationId: "sample:primary",
    conversationSequence: sequence,
    source: { kind: "human", id },
    input: { kind: "message", data: { text: "Review" } },
  });
}

test.each(["throws", "invalid", "missing-topic"])(
  "ends a %s execution once, survives reopen, and frees the Conversation",
  async (mode) => {
    const f = fixture();
    let calls = 0;
    let now = 1000;
    const options = {
      apps: [app],
      now: () => now,
      resolveRequest: async () => {
        calls++;
        if (mode === "throws") throw new Error("fixture failure");
        if (mode === "missing-topic") return {
          ...answer,
          followUp: { appId: "owner", outcome: "Compare", acceptance: ["Evidence"], input: {} },
        };
        return {} as AppRequestDecision;
      },
    };
    const host = new AppInboxHost({ ...options, db: f.db });
    admit(host);
    for (let i = 0; i < 6; i++) {
      now += 2000;
      await host.reconcileOnce(app.id);
    }
    const reopened = new AppInboxHost({ ...options, db: f.open() });
    for (let i = 0; i < 6; i++) {
      now += 2000;
      await reopened.reconcileOnce(app.id);
    }
    expect(calls).toBe(1);
    expect(reopened.get("first")).toMatchObject({ status: "done", handling: { phase: "failed" } });
    expect(readAppConversationResource(f.db, app.id, "sample:primary").messages.at(-1)?.text).toContain(
      "ask remains unresolved",
    );
    const next = new AppInboxHost({ ...options, db: f.db, resolveRequest: async () => answer });
    admit(next, "second", 2);
    expect((await next.reconcileOnce(app.id)).admitted).toBe(1);
  },
);

test("recovers a failure that could not be recorded without another model call", async () => {
  const f = fixture();
  let now = 1000;
  let calls = 0;
  const host = new AppInboxHost({
    db: f.db,
    apps: [app],
    now: () => now,
    leaseMs: 1000,
    resolveRequest: async () => {
      calls++;
      f.db.exec(`CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items
        WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture result write failure'); END;`);
      throw new Error("fixture model failure");
    },
  });
  admit(host);
  expect((await host.reconcileOnce(app.id)).errors.length).toBe(2);
  expect(host.get("first")?.handling?.phase).toBe("executing");
  f.db.exec("DROP TRIGGER reject_result");
  now += 2000;
  const after = new AppInboxHost({
    db: f.open(),
    apps: [app],
    now: () => now,
    resolveRequest: async () => {
      calls++;
      return answer;
    },
  });
  await after.reconcileOnce(app.id);
  expect(calls).toBe(1);
  expect(after.get("first")?.handling?.phase).toBe("failed");
});

test.each(["new", "existing"] as const)(
  "rolls back the %s Topic decision when saving its handling fails, including after reopen",
  async (kind) => {
    const f = fixture();
    if (kind === "existing")
      createConversationTopic(f.db, {
        id: "topic",
        appId: app.id,
        conversationId: "sample:primary",
        title: "Existing work",
        openedBy: "human",
        originMessageId: "earlier",
      });
    f.db.exec(`CREATE TRIGGER reject_decision BEFORE UPDATE OF handling ON app_inbox_items
      WHEN json_extract(NEW.handling, '$.phase') = 'decided'
      BEGIN SELECT RAISE(ABORT, 'fixture decision write failure'); END;
      CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items
      WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture result write failure'); END;`);
    let now = 1000;
    let calls = 0;
    const options = {
      apps: [app],
      now: () => now,
      leaseMs: 1000,
      resolveRequest: async (): Promise<AppRequestDecision> => {
        calls++;
        return {
          ...answer,
          topic: kind === "new" ? { kind, title: "Work" } : { kind, id: "topic" },
          requestUpdates: [{ id: "ask", expectedRevision: 0, scope: "Review work", disposition: "open" }],
        };
      },
    };
    const before = new AppInboxHost({ ...options, db: f.db });
    admit(before);
    const result = await before.reconcileOnce(app.id);
    expect(result.errors).toEqual([
      "Request first: fixture decision write failure",
      "Request first cleanup: fixture result write failure",
    ]);

    const db = f.open();
    const after = new AppInboxHost({ ...options, db });
    expect(after.get("first")?.handling?.phase).toBe("executing");
    expect(after.get("first")?.topicId).toBeUndefined();
    const conversation = readAppConversationResource(db, app.id, "sample:primary");
    expect(conversation.topics.map((topic) => topic.id)).toEqual(kind === "new" ? [] : ["topic"]);
    expect(conversation.requests).toHaveLength(0);

    db.exec("DROP TRIGGER reject_decision; DROP TRIGGER reject_result;");
    now += 2000;
    await after.reconcileOnce(app.id);
    expect(calls).toBe(1);
    expect(after.get("first")).toMatchObject({ status: "done", handling: { phase: "failed" } });
    expect(after.get("first")?.topicId).toBeUndefined();
    expect(after.get("first")?.result?.response).not.toBe(answer.response);
  },
);

test("replays a saved decision after result persistence fails and ignores failed publication", async () => {
  const f = fixture();
  let now = 1000;
  let calls = 0;
  f.db.exec(`CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture result write failure'); END;`);
  const options = {
    apps: [app],
    now: () => now,
    resolveRequest: async () => {
      calls++;
      return answer;
    },
    onRequestCompleted: () => {
      throw new Error("fixture notification failure");
    },
  };
  const host = new AppInboxHost({ ...options, db: f.db });
  admit(host);
  await host.reconcileOnce(app.id);
  expect(host.get("first")?.handling?.phase).toBe("decided");
  f.db.exec("DROP TRIGGER reject_result");
  now += 2000;
  const after = new AppInboxHost({ ...options, db: f.open() });
  await after.reconcileOnce(app.id);
  now += 2000;
  await after.reconcileOnce(app.id);
  expect(calls).toBe(1);
  expect(after.get("first")).toMatchObject({ status: "done", result: { response: answer.response } });
  expect(
    readAppConversationResource(f.db, app.id, "sample:primary").messages.filter((m) => m.id === "result:first"),
  ).toHaveLength(1);
});

test.each(["control", "handoff"])("a rejected %s ends the turn instead of replaying forever", async (effect) => {
  const f = fixture();
  createConversationTopic(f.db, {
    id: "topic",
    appId: app.id,
    conversationId: "sample:primary",
    title: "Existing work",
    openedBy: "human",
    originMessageId: "earlier",
  });
  linkConversationTopicTask(f.db, "topic", owner.id, "work");
  let now = 1000;
  let calls = 0;
  let effects = 0;
  const reject = async () => {
    effects++;
    throw new Error("This Task does not accept this operation");
  };
  const options = {
    apps: [app, owner],
    now: () => now,
    resolveRequest: async (): Promise<AppRequestDecision> => {
      calls++;
      return {
        ...answer,
        topic: { kind: "existing", id: "topic" },
        ...(effect === "control"
          ? { taskControls: [{ kind: "cancel" as const, appId: owner.id, taskId: "work", reason: "Human requested" }] }
          : {
              followUp: {
                appId: owner.id,
                input: { kind: "work", data: {} },
                outcome: "Work",
                acceptance: ["Verified"],
              },
            }),
      };
    },
    controlTask: reject,
    onRequestFollowUp: reject,
  };
  const before = new AppInboxHost({ ...options, db: f.db });
  admit(before);
  await before.reconcileOnce(app.id);
  const after = new AppInboxHost({ ...options, db: f.open() });
  for (let i = 0; i < 12; i++) {
    now += 2000;
    await after.reconcileOnce(app.id);
  }
  expect(calls).toBe(1);
  expect(effects).toBe(1);
  expect(after.get("first")).toMatchObject({ status: "done", handling: { phase: "failed" } });
  expect(after.get("first")?.result?.response).toContain("This Task does not accept this operation");
  const next = new AppInboxHost({ ...options, db: f.db, resolveRequest: async () => answer });
  admit(next, "second", 2);
  expect((await next.reconcileOnce(app.id)).admitted).toBe(1);
});

test.each(["available", "removed"])(
  "recovers a saved handoff after a failed result write with its App %s",
  async (availability) => {
    const f = fixture();
    let now = 1000;
    let calls = 0;
    let effects = 0;
    f.db.exec(`CREATE TRIGGER reject_result BEFORE UPDATE ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fixture result write failure'); END;`);
    const options = {
      apps: [app, owner],
      now: () => now,
      resolveRequest: async (): Promise<AppRequestDecision> => {
        calls++;
        return {
          ...answer,
          topic: { kind: "new", title: "Work" },
          followUp: { appId: owner.id, input: { kind: "work", data: {} }, outcome: "Work", acceptance: ["Verified"] },
        };
      },
      onRequestFollowUp: () => {
        effects++;
      },
    };
    const before = new AppInboxHost({ ...options, db: f.db });
    admit(before);
    await before.reconcileOnce(app.id);
    expect(before.get("first")?.handling?.phase).toBe("decided");
    const topicId = before.get("first")?.topicId;
    expect(topicId).toBeDefined();
    expect(effects).toBe(1);
    f.db.exec("DROP TRIGGER reject_result");
    const db = f.open();
    const after = new AppInboxHost({
      ...options,
      db,
      apps: availability === "available" ? [app, owner] : [app],
    });
    expect(after.get("first")).toMatchObject({ topicId, handling: { phase: "decided" } });
    expect(readAppConversationResource(db, app.id, "sample:primary").topics.map((topic) => topic.id)).toEqual([
      topicId,
    ]);
    for (let i = 0; i < 12; i++) {
      now += 2000;
      await after.reconcileOnce(app.id);
    }
    expect(calls).toBe(1);
    expect(after.get("first")?.status).toBe("done");
    expect(after.get("first")?.topicId).toBe(topicId);
    expect(readAppConversationResource(db, app.id, "sample:primary").topics.map((topic) => topic.id)).toEqual([
      topicId,
    ]);
    if (availability === "available") {
      expect(effects).toBe(2);
      expect(after.get("first")?.result?.response).toBe(answer.response);
    } else {
      expect(effects).toBe(1);
      expect(after.get("first")?.handling?.phase).toBe("failed");
    }
  },
);
