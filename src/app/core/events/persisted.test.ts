import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../../lib/db-writer.js";
import { describeText } from "../../../lib/artifacts.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { EVENT_ROW_ID, EventBus } from "./bus.js";
import { loadPersistedEvent } from "./persisted.js";
import { getEventView } from "./interface.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";

test("persisted event replay uses verified full facts, never a truncated or corrupt body", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-replay-"));
  try {
    const bus = new EventBus();
    bus.setPersistenceSubscriber(new DbWriter(root).handler);
    const data = { appId: "may", text: "Original input. ".repeat(1_000) };
    const event = bus.emit({ type: "conversation.message.created", source: "telegram", owner: "app:may", data });
    const eventId = Number(event[EVENT_ROW_ID]);
    const db = getDb(root);
    const row = db.prepare("SELECT body_ref FROM events WHERE id = ?").get(eventId)!;
    expect(row.body_ref).toBeString();
    expect(loadPersistedEvent(db, eventId, root)).toMatchObject({
      type: "conversation.message.created",
      source: "telegram",
      data,
    });
    expect(loadPersistedEvent(db, eventId)).toBeNull();
    writeFileSync(join(root, String(row.body_ref)), JSON.stringify({ appId: "may", text: "Wrong input" }));
    expect(loadPersistedEvent(db, eventId, root)).toBeNull();
    const invalidObject = "[]\n";
    writeFileSync(join(root, String(row.body_ref)), invalidObject);
    const descriptor = describeText(String(row.body_ref), invalidObject);
    db.prepare("UPDATE events SET body_sha256 = ?, body_bytes = ? WHERE id = ?")
      .run(descriptor.sha256, descriptor.bytes, eventId);
    expect(loadPersistedEvent(db, eventId, root)).toBeNull();
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("stored targets retain internal fields; missing history stays unknown and damaged routing is not replayed", () => {
  const root = mkdtempSync(join(tmpdir(), "may-target-replay-"));
  try {
    const bus = new EventBus();
    bus.setPersistenceSubscriber(new DbWriter(root).handler);
    const target = { project: "destination.app", taskId: "review", sessionId: "recipient-session", human: true };
    const event = bus.emit({
      type: "fixture.observed",
      source: "fixture",
      owner: "app:producer",
      target,
      data: { appId: "subject", taskId: "subject-task", sessionId: "producer-session" },
    });
    const id = Number(event[EVENT_ROW_ID]);
    closeDb(root);
    const db = getDb(root);
    expect(loadPersistedEvent(db, id)).toMatchObject({ target });
    const metadata = JSON.parse(String(db.prepare("SELECT envelope_json FROM events WHERE id = ?").get(id)!.envelope_json));
    db.prepare("UPDATE events SET envelope_json = NULL WHERE id = ?").run(id);
    expect(loadPersistedEvent(db, id)).not.toHaveProperty("target");
    expect(getEventView(db, id)?.event).not.toHaveProperty("target");
    for (const value of ["{broken", "[]", "null", "{}", JSON.stringify({ type: "fixture.observed", target: [] })]) {
      db.prepare("UPDATE events SET envelope_json = ? WHERE id = ?").run(value, id);
      expect(loadPersistedEvent(db, id)).toBeNull();
      expect(() => getEventView(db, id)).toThrow("Stored event envelope");
    }
    for (const patch of [
      { type: "fixture.changed" }, { source: 42 }, { owner: [] }, { timestamp: "bad" },
      { urgency: "unknown" }, { action: {} }, { ttl_ms: "90" }, { target: { human: "yes" } },
      ...["appId", "project", "taskId", "executionId", "sessionId", "metricId", "owner"]
        .map((key) => ({ target: { [key]: 42 } })),
    ]) {
      db.prepare("UPDATE events SET envelope_json = ? WHERE id = ?").run(JSON.stringify({ ...metadata, ...patch }), id);
      expect(loadPersistedEvent(db, id)).toBeNull();
      expect(() => getEventView(db, id)).toThrow("Stored event envelope");
    }
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("inline replay verifies stored bytes and hash and requires an object, including legacy rows", () => {
  const root = mkdtempSync(join(tmpdir(), "may-inline-replay-"));
  try {
    const bus = new EventBus();
    bus.setPersistenceSubscriber(new DbWriter(root).handler);
    const data = { requestId: "reload-original", reason: "Review café" };
    const event = bus.emit({ type: "runtime.reload.requested", source: "telegram", owner: "agent:may", data });
    const id = Number(event[EVENT_ROW_ID]);
    const db = getDb(root);
    const original = db.prepare("SELECT data, body_ref, body_sha256, body_bytes FROM events WHERE id = ?").get(id)!;
    expect(original.body_ref).toBeNull();
    expect(loadPersistedEvent(db, id, root)?.data).toEqual(data);
    const update = db.prepare("UPDATE events SET data = ?, body_sha256 = ?, body_bytes = ? WHERE id = ?");
    for (const [body, sha, bytes] of [
      [JSON.stringify({ ...data, requestId: "reload-modified" }), original.body_sha256, original.body_bytes],
      [original.data, "wrong-hash", original.body_bytes],
      [original.data, original.body_sha256, 0],
    ]) {
      update.run(body, sha, bytes, id);
      expect(loadPersistedEvent(db, id, root)).toBeNull();
    }
    for (const body of ["{broken", "[]", "null", '"text"']) {
      const descriptor = describeText("", `${body}\n`);
      update.run(body, descriptor.sha256, descriptor.bytes, id);
      expect(loadPersistedEvent(db, id, root)).toBeNull();
      update.run(body, null, null, id);
      expect(loadPersistedEvent(db, id, root)).toBeNull();
    }
    update.run(original.data, null, null, id);
    expect(loadPersistedEvent(db, id, root)?.data).toEqual(data);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("reopening preserves the complete App event and causal context for recovered children", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-contract-"));
  try {
    const bus = new EventBus();
    bus.setPersistenceSubscriber(new DbWriter(root).handler);
    const reference = bus.emit({ type: "fixture.reference", source: "fixture", owner: "app:producer", data: {} });
    const referenceId = Number(reference[EVENT_ROW_ID]);
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "fixture.observed") return;
      bus.emit({ type: "fixture.child", source: "fixture", owner: "app:consumer", data: {} });
      return { accepted: true, by: "fixture", route: "direct" };
    });
    const trace = { traceId: "original-chain", parentEventId: referenceId,
      links: [{ eventId: referenceId, type: "reference" as const, label: "support" }] };
    const original = bus.emit({
      type: "fixture.observed", source: "fixture", owner: "app:producer",
      target: { appId: "recipient", taskId: "recipient-task" }, action: "review",
      trace, visibility: "detail", ttl_ms: 90_000,
      data: { appId: "subject", taskId: "subject-task", text: "evidence ".repeat(1_000) },
      extension: { label: "future-envelope-field", value: 1 },
    });
    const id = Number(original[EVENT_ROW_ID]);
    closeDb(root);
    const db = getDb(root);
    bus.setPersistenceSubscriber(new DbWriter(root).handler);
    const restored = loadPersistedEvent(db, id, root)!;
    expect(canonicalAppEvent(original)).toMatchObject({ action: "review", urgency: "normal" });
    expect(canonicalAppEvent(restored)).toEqual(canonicalAppEvent(original));
    expect(restored).toMatchObject({ trace, visibility: "detail", ttl_ms: 90_000,
      extension: { label: "future-envelope-field", value: 1 } });
    bus.redeliverPersisted(restored, id);
    const children = db.prepare(`SELECT t.trace_id, t.parent_event_id FROM events e
      JOIN event_traces t ON t.event_id = e.id WHERE e.event_type = 'fixture.child' ORDER BY e.id`).all();
    expect(children).toEqual([
      { trace_id: "original-chain", parent_event_id: id },
      { trace_id: "original-chain", parent_event_id: id },
    ]);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
