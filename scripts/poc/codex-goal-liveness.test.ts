import { describe, expect, it } from "bun:test";
import { decideCodexGoalLiveness } from "./codex-goal-liveness.js";

const base = {
  nowMs: 10_000,
  lastActivityAtMs: 9_500,
  softStaleAfterMs: 1_000,
  hardStaleAfterMs: 5_000,
  nudgeCount: 0,
  taskPaused: false,
  turnActive: true,
  goalStatus: "active" as const,
};

describe("decideCodexGoalLiveness", () => {
  it("leaves healthy work alone", () => {
    expect(decideCodexGoalLiveness(base).kind).toBe("observe");
  });

  it("reactivates paused or idle Codex work only while the May Task remains pending", () => {
    expect(decideCodexGoalLiveness({ ...base, goalStatus: "paused" }).kind).toBe("reactivate");
    expect(decideCodexGoalLiveness({ ...base, turnActive: false }).kind).toBe("reactivate");
    expect(decideCodexGoalLiveness({ ...base, goalStatus: "paused", taskPaused: true }).kind).toBe("observe");
  });

  it("nudges once after soft staleness and interrupts after hard staleness", () => {
    expect(decideCodexGoalLiveness({ ...base, lastActivityAtMs: 8_000 }).kind).toBe("steer");
    expect(decideCodexGoalLiveness({ ...base, lastActivityAtMs: 8_000, nudgeCount: 1 }).kind).toBe("observe");
    expect(decideCodexGoalLiveness({ ...base, lastActivityAtMs: 4_000, nudgeCount: 1 }).kind).toBe("interrupt");
  });

  it("surfaces exact blocked or exhausted states instead of blindly pushing", () => {
    expect(decideCodexGoalLiveness({ ...base, goalStatus: "blocked" }).kind).toBe("report-wait");
    expect(decideCodexGoalLiveness({ ...base, goalStatus: "usageLimited" }).kind).toBe("report-wait");
    expect(decideCodexGoalLiveness({ ...base, goalStatus: "budgetLimited" }).kind).toBe("report-wait");
  });
});
