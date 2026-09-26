import { describe, expect, it } from "bun:test";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import type { IndexedTaskCandidate, IndexedTaskRecoveryCursor } from "../state/app-task-resource-store.js";

describe("AppTaskRecoveryScheduler", () => {
  it("performs one bounded startup query and preserves the trusted lane", () => {
    const calls: Array<{ now?: number; limit?: number }> = [];
    const queued: Array<{ taskId: string; lane: string }> = [];
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
      { taskId: "human", lane: "human" },
      { taskId: "normal", lane: "normal" },
    ]);
    scheduler.close();
  });

  it("uses one nearest-due timer without polling before it is due", async () => {
    let dueAt: number | null = null;
    const recoveryTimes: number[] = [];
    const queued: string[] = [];
    let onEnqueue: () => void = () => {};
    const scheduler = new AppTaskRecoveryScheduler({
      source: {
        listRecoveryCandidates(now = Date.now()) {
          recoveryTimes.push(now);
          return {
            items:
              dueAt !== null && now >= dueAt
                ? [
                    {
                      taskId: "due-task",
                      lane: "normal",
                      ready: false,
                      changed: false,
                      nextCheckAt: dueAt,
                      leaseUntil: null,
                    },
                  ]
                : [],
            nextCursor: null,
          };
        },
        nextDueAt: () => dueAt,
      },
      enqueue: (taskId) => {
        queued.push(taskId);
        onEnqueue();
      },
      safetyIntervalMs: 10_000,
    });

    try {
      scheduler.start();
      expect(recoveryTimes).toHaveLength(1);
      expect(queued).toEqual([]);

      for (let occurrence = 1; occurrence <= 2; occurrence++) {
        const deadline = Date.now() + 30;
        await new Promise<void>((resolve) => {
          onEnqueue = resolve;
          dueAt = deadline;
          scheduler.stateChanged();
        });
        // Record when recovery actually ran. A sleep can resume after its
        // requested delay, so it cannot prove the deadline is still ahead.
        expect(recoveryTimes).toHaveLength(occurrence + 1);
        expect(recoveryTimes[occurrence]).toBeGreaterThanOrEqual(deadline);
        expect(queued).toEqual(Array(occurrence).fill("due-task"));
      }
    } finally {
      scheduler.close();
    }
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
