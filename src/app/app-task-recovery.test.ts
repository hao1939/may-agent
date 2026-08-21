import { describe, expect, it } from "bun:test";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import type { IndexedTaskCandidate, IndexedTaskRecoveryCursor } from "./app-task-resource-store.js";

describe("AppTaskRecoveryScheduler", () => {
  it("performs one bounded startup query and preserves the trusted lane", () => {
    const calls: Array<{ now?: number; limit?: number }> = [];
    const queued: Array<{ taskId: string; lane: string; front: boolean }> = [];
    const candidates: IndexedTaskCandidate[] = [
      { taskId: "human", lane: "human", ready: true, changed: true, nextCheckAt: null, leaseUntil: null },
      { taskId: "normal", lane: "normal", ready: false, changed: true, nextCheckAt: null, leaseUntil: null },
    ];
    const scheduler = new AppTaskRecoveryScheduler({
      source: {
        listRecoveryCandidates(now, limit) {
          calls.push({ now, limit });
          return { items: candidates, nextCursor: null };
        },
        nextDueAt: () => null,
      },
      enqueue: (taskId, options) => queued.push({ taskId, ...options }),
      pageSize: 32,
      now: () => 100,
    });

    scheduler.start();
    expect(calls).toEqual([{ now: 100, limit: 32 }]);
    expect(queued).toEqual([
      { taskId: "human", lane: "human", front: true },
      { taskId: "normal", lane: "normal", front: true },
    ]);
    scheduler.close();
  });

  it("uses one nearest-due timer without polling before it is due", async () => {
    let dueAt = Date.now() + 25;
    let recoveries = 0;
    const scheduler = new AppTaskRecoveryScheduler({
      source: {
        listRecoveryCandidates() {
          recoveries += 1;
          return { items: [], nextCursor: null };
        },
        nextDueAt: () => dueAt,
      },
      enqueue: () => {},
      safetyIntervalMs: 10_000,
    });

    scheduler.start();
    expect(recoveries).toBe(1);
    await Bun.sleep(40);
    expect(recoveries).toBe(2);
    dueAt = Date.now() + 20;
    scheduler.stateChanged();
    await Bun.sleep(30);
    expect(recoveries).toBe(3);
    scheduler.close();
  });

  it("advances through bounded recovery pages instead of repeating the first page", () => {
    const cursors: Array<IndexedTaskRecoveryCursor | undefined> = [];
    const queued: string[] = [];
    const next: IndexedTaskRecoveryCursor = { lane: "normal", updatedAt: 1, taskId: "b" };
    const scheduler = new AppTaskRecoveryScheduler({
      source: {
        listRecoveryCandidates(_now, _limit, after) {
          cursors.push(after);
          return after
            ? {
                items: [
                  { taskId: "c", lane: "normal", ready: true, changed: false, nextCheckAt: null, leaseUntil: null },
                ],
                nextCursor: null,
              }
            : {
                items: [
                  { taskId: "a", lane: "human", ready: true, changed: false, nextCheckAt: null, leaseUntil: null },
                  { taskId: "b", lane: "normal", ready: true, changed: false, nextCheckAt: null, leaseUntil: null },
                ],
                nextCursor: next,
              };
        },
        nextDueAt: () => null,
      },
      enqueue: (taskId) => queued.push(taskId),
      pageSize: 2,
      now: () => 100,
    });

    expect(scheduler.recover()).toBe(2);
    expect(scheduler.recover()).toBe(1);
    expect(cursors).toEqual([undefined, next]);
    expect(queued).toEqual(["a", "b", "c"]);
    scheduler.close();
  });
});
