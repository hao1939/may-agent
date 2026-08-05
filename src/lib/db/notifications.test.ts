import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import {
  hasDeliveredNotificationKey,
  isApprovalNotificationResolved,
  storeNotificationMessage,
} from "./notifications.js";

const dirs: string[] = [];

function stateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "may-notifications-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    closeDb(dir);
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("approval notification lifecycle", () => {
  test("deduplicates a delivered stable notification key", () => {
    const dir = stateDir();
    storeNotificationMessage(dir, {
      telegram_msg_id: 41,
      event_type: "message.created",
      agent: "gym",
      session_id: null,
      project_id: "projects/gym.app",
      data: JSON.stringify({ dedupKey: "approval:one" }),
    });

    expect(hasDeliveredNotificationKey(dir, "approval:one")).toBe(true);
    expect(hasDeliveredNotificationKey(dir, "approval:two")).toBe(false);
  });

  test("does not let an older same-task approval resolve a new exact approval", () => {
    const dir = stateDir();
    getDb(dir).run(
      `INSERT INTO events (event_type, source, owner, data, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "project.approval.submitted",
        "human",
        "agent:gym",
        JSON.stringify({
          approvalId: "new-fingerprint",
          taskId: "runtime/review-proposal/incident-1",
          taskGeneration: 1,
          decision: "approve",
        }),
        Date.now(),
      ],
    );

    expect(
      isApprovalNotificationResolved(dir, {
        approvalId: "old-fingerprint",
        taskId: "runtime/review-proposal/incident-1",
        taskGeneration: 1,
      }),
    ).toBe(false);
    expect(
      isApprovalNotificationResolved(dir, {
        approvalId: "old-fingerprint",
        taskId: "runtime/review-proposal/incident-1",
        taskGeneration: 2,
      }),
    ).toBe(false);
    expect(
      isApprovalNotificationResolved(dir, {
        taskId: "runtime/review-proposal/incident-1",
        taskGeneration: 1,
      }),
    ).toBe(true);
  });
});
