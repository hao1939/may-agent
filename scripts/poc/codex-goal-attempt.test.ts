import { describe, expect, it } from "bun:test";
import {
  boundedStaleBackoffMs,
  reconcileCodexGoalAttemptLiveness,
  type CodexGoalAttemptControl,
} from "./codex-goal-attempt.js";

function fixture() {
  const calls: string[] = [];
  const control: CodexGoalAttemptControl = {
    async reactivate() {
      calls.push("reactivate");
    },
    async steer(turnId, message) {
      calls.push(`steer:${turnId}:${message}`);
    },
    async interrupt(turnId) {
      calls.push(`interrupt:${turnId}`);
    },
    async waitForTerminalTurn(turnId) {
      calls.push(`terminal:${turnId}`);
      return "interrupted";
    },
  };
  return { calls, control };
}

const base = {
  turnId: "turn-1",
  staleInterruptCount: 0,
  nudgeMessage: "Report current progress or stop safely.",
  nowMs: 10_000,
  lastActivityAtMs: 9_500,
  softStaleAfterMs: 1_000,
  hardStaleAfterMs: 5_000,
  nudgeCount: 0,
  taskPaused: false,
  turnActive: true,
  goalStatus: "active" as const,
};

describe("reconcileCodexGoalAttemptLiveness", () => {
  it("does no protocol work for a healthy or explicitly paused Task", async () => {
    for (const input of [base, { ...base, taskPaused: true, lastActivityAtMs: 0 }]) {
      const f = fixture();
      expect((await reconcileCodexGoalAttemptLiveness({ ...input, control: f.control })).disposition.kind).toBe(
        "observe",
      );
      expect(f.calls).toEqual([]);
    }
  });

  it("sends one exact-turn nudge and does not create a second nudge", async () => {
    const first = fixture();
    const nudged = await reconcileCodexGoalAttemptLiveness({
      ...base,
      control: first.control,
      lastActivityAtMs: 8_000,
    });
    expect(nudged.disposition).toMatchObject({ kind: "observe", nudgeCount: 1 });
    expect(first.calls).toEqual(["steer:turn-1:Report current progress or stop safely."]);

    const second = fixture();
    await reconcileCodexGoalAttemptLiveness({
      ...base,
      control: second.control,
      lastActivityAtMs: 8_000,
      nudgeCount: 1,
    });
    expect(second.calls).toEqual([]);
  });

  it("waits for authoritative terminal interruption before bounded requeue", async () => {
    const f = fixture();
    const result = await reconcileCodexGoalAttemptLiveness({
      ...base,
      control: f.control,
      lastActivityAtMs: 0,
      staleInterruptCount: 3,
      nudgeCount: 1,
    });
    expect(f.calls).toEqual(["interrupt:turn-1", "terminal:turn-1"]);
    expect(result.disposition).toEqual({
      kind: "requeue",
      reason: "Codex turn crossed the hard stale threshold; turn ended interrupted",
      backoffMs: 8_000,
      terminalTurnStatus: "interrupted",
      nudgeCount: 1,
    });
  });

  it("reactivates idle pending work and bounds repeated stale backoff", async () => {
    const f = fixture();
    await reconcileCodexGoalAttemptLiveness({ ...base, control: f.control, turnId: null, turnActive: false });
    expect(f.calls).toEqual(["reactivate"]);
    expect([0, 1, 2, 6, 20].map(boundedStaleBackoffMs)).toEqual([1_000, 2_000, 4_000, 60_000, 60_000]);
  });
});
