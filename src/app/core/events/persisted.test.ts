import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { EVENT_ROW_ID, EventBus } from "./bus.js";
import { loadPersistedEvent } from "./persisted.js";

test("persisted event replay uses verified full evidence, never a truncated or corrupt body", () => {
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
      target: { appId: "may" },
      data,
    });
    expect(loadPersistedEvent(db, eventId)).toBeNull();
    writeFileSync(join(root, String(row.body_ref)), JSON.stringify({ appId: "may", text: "Wrong input" }));
    expect(loadPersistedEvent(db, eventId, root)).toBeNull();
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
