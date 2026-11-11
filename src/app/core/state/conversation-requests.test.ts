import type { AppConversationRequestUpdate } from "@may-agent/sdk";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/requests.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";
const app = { id: "sample" };
const owner = { id: "owner" };
const ask: AppConversationRequestUpdate = { id: "comparison", expectedRevision: 0, scope: "Compare two options", disposition: "open" };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) { closeDb(root); rmSync(root, { recursive: true, force: true }); } });

test("Task references accumulate without duplicates; overflow rolls back the update batch", () => {
  const root = mkdtempSync(join(tmpdir(), "may-request-store-"));
  roots.push(root);
  const db = getDb(root);
  // References remain useful metadata even when the named work is unavailable.
  const refs = Array.from({ length: 33 }, (_, i) => ({ appId: owner.id, taskId: `work-${i}` }));
  const update = (updates: AppConversationRequestUpdate[], updateKey: string) =>
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "chat",
      updates,
      updateKey,
      now: 1,
    });
  update([{ ...ask, taskRefs: refs.slice(0, 31) }], "accept");
  const addition = { ...ask, expectedRevision: 1, taskRefs: [refs[30]!, refs[31]!, refs[31]!] };
  update([addition], "add");
  update([addition], "add");
  expect(readConversationRequest(db, app.id, "chat", ask.id)).toMatchObject({
    revision: 2,
    taskRefs: refs.slice(0, 32),
  });
  expect(() =>
    update(
      [
        { ...ask, id: "rollback" },
        { ...ask, expectedRevision: 2, taskRefs: [refs[32]!] },
      ],
      "overflow",
    ),
  ).toThrow("Task link limit reached");
  expect(readConversationRequest(db, app.id, "chat", "rollback")).toBeNull();
  expect(readConversationRequest(db, app.id, "chat", ask.id)?.revision).toBe(2);
});
