import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/cost-limit.js";

describe("cost-limit guard", () => {
  const makeEvent = (completedTurns: number[], currentTurns: number): any => ({
    type: "step_done",
    step: "test",
    result: { turnsUsed: currentTurns },
    completedSteps: completedTurns.map(t => ({ result: { turnsUsed: t } })),
  });

  it("returns empty below warn threshold", () => {
    expect(guard.handle(makeEvent([10, 10], 5))).toEqual([]);
  });
  it("warns at 40 turns", () => {
    const demands = guard.handle(makeEvent([20, 15], 5));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
  it("blocks at 60 turns", () => {
    const demands = guard.handle(makeEvent([30, 20], 10));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
  it("returns empty for non-step_done", () => {
    expect(guard.handle({ type: "step_start" } as any)).toEqual([]);
  });
  it("handles missing turnsUsed", () => {
    const event = { type: "step_done", step: "x", result: {}, completedSteps: [{ result: {} }] };
    expect(guard.handle(event as any)).toEqual([]);
  });
});
