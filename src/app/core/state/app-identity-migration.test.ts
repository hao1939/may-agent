import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { AppDefinition } from "@may-agent/sdk";
import { Type } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { resolveTaskReference, taskReferenceDigest } from "./task-reference-index.js";
import { migrateAppIdentities } from "./app-identity-migration.js";

const oldId = "scout-knowledge-lib";
const canonicalId = "scout-lib";
const definition = {
  id: canonicalId,
  previousIds: [oldId],
  version: 1,
  agent: "scout",
  inputSchema: Type.Object({}),
} as AppDefinition;

describe("App identity migration", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

  it("moves live App state atomically while retaining old human Task references", () => {
    const resource = JSON.stringify({ metadata: { id: "explore-hn" }, spec: { appId: oldId, project: oldId } });
    db.prepare(
      `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane,
       changed, ready, updated_at, resource_json) VALUES (?, 'explore-hn', 1, 1, 0, 'pending', 'normal', 1, 1, 1, ?)`,
    ).run(oldId, resource);
    db.prepare("INSERT INTO app_task_store_meta(app_id, key, value) VALUES (?, 'schema_version', '3')").run(oldId);
    db.prepare("INSERT INTO app_task_groups(app_id, group_id, group_json) VALUES (?, 'ongoing-research', ?)").run(
      oldId,
      JSON.stringify({ id: "ongoing-research", appId: oldId }),
    );
    db.prepare(
      `INSERT INTO app_task_refs(digest, prefix8, prefix16, app_id, task_id, indexed_at)
       VALUES (?, ?, ?, ?, 'explore-hn', 1)`,
    ).run(
      taskReferenceDigest(oldId, "explore-hn"),
      taskReferenceDigest(oldId, "explore-hn").slice(0, 8),
      taskReferenceDigest(oldId, "explore-hn").slice(0, 16),
      oldId,
    );
    db.prepare(
      `INSERT INTO app_inbox_items(id, app_id, source_kind, source_id, input_kind, input_data, status,
       idempotency_key, created_at, updated_at) VALUES ('input-1', ?, 'app', ?, 'goal', '{}', 'pending', ?, 1, 1)`,
    ).run(oldId, oldId, `task-dependency:${oldId}:parent:child`);
    db.prepare(
      `INSERT INTO conversation_topics(id, app_id, conversation_id, title, opened_by, origin_message_id, created_at)
       VALUES ('topic-1', ?, 'primary', 'Scout work', 'human', 'message-1', 1)`,
    ).run(oldId);
    db.prepare(
      "INSERT INTO conversation_topic_tasks(topic_id, app_id, task_id, linked_at) VALUES ('topic-1', ?, 'explore-hn', 1)",
    ).run(oldId);
    db.prepare(
      `INSERT INTO conversation_requests(app_id, conversation_id, id, revision, scope, status, topic_id,
       task_refs, update_key, updated_at) VALUES ('may', 'primary', 'request-1', 1, 'Track Scout', 'open',
       'topic-1', ?, 'request-1:1', 1)`,
    ).run(JSON.stringify([{ appId: oldId, taskId: "explore-hn" }]));
    db.prepare("INSERT INTO projects(id, path, name, owner) VALUES (?, ?, ?, 'scout')").run(
      oldId,
      `${oldId}.app`,
      oldId,
    );

    const oldReference = taskReferenceDigest(oldId, "explore-hn");
    migrateAppIdentities(db, [definition]);
    migrateAppIdentities(db, [definition]);

    expect(db.prepare("SELECT app_id FROM app_tasks WHERE task_id = 'explore-hn'").get()).toEqual({
      app_id: canonicalId,
    });
    expect(JSON.parse(String(db.prepare("SELECT resource_json FROM app_tasks").get()?.resource_json))).toMatchObject({
      spec: { appId: canonicalId, project: canonicalId },
    });
    expect(db.prepare("SELECT app_id, source_id, idempotency_key FROM app_inbox_items").get()).toEqual({
      app_id: canonicalId,
      source_id: canonicalId,
      idempotency_key: `task-dependency:${canonicalId}:parent:child`,
    });
    expect(db.prepare("SELECT app_id FROM conversation_topics").get()).toEqual({ app_id: canonicalId });
    expect(db.prepare("SELECT app_id FROM conversation_topic_tasks").get()).toEqual({ app_id: canonicalId });
    expect(JSON.parse(String(db.prepare("SELECT task_refs FROM conversation_requests").get()?.task_refs))).toEqual([
      { appId: canonicalId, taskId: "explore-hn" },
    ]);
    expect(db.prepare("SELECT id, name FROM projects").get()).toEqual({ id: canonicalId, name: canonicalId });
    expect(resolveTaskReference(db, oldReference)).toEqual({
      kind: "resolved",
      task: { appId: canonicalId, taskId: "explore-hn", digest: oldReference },
    });
    expect(resolveTaskReference(db, taskReferenceDigest(canonicalId, "explore-hn"))).toMatchObject({
      kind: "resolved",
      task: { appId: canonicalId, taskId: "explore-hn" },
    });
  });

  it("rolls back every change when canonical state conflicts", () => {
    for (const appId of [oldId, canonicalId]) {
      db.prepare(
        `INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation, phase, lane,
         changed, ready, updated_at, resource_json) VALUES (?, 'same-task', 1, 1, 0, 'pending', 'normal', 1, 1, 1, '{}')`,
      ).run(appId);
    }

    expect(() => migrateAppIdentities(db, [definition])).toThrow("Cannot rename App");
    expect(db.prepare("SELECT app_id FROM app_tasks ORDER BY app_id").all()).toEqual([
      { app_id: oldId },
      { app_id: canonicalId },
    ]);
  });
});
