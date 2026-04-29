import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/build-check.js";

describe("build-check guard", () => {
  const makeEvent = (step: string, text: string, source = "agent"): any => ({
    type: "step_done",
    step,
    source,
    result: { lastAssistantText: text },
  });

  it("returns empty for non-step_done", () => {
    expect(guard.handle({ type: "step_start" } as any)).toEqual([]);
  });
  it("returns empty for non-agent source", () => {
    expect(guard.handle(makeEvent("coder", "did stuff", "function"))).toEqual([]);
  });
  it("returns empty for non-coding steps", () => {
    expect(guard.handle(makeEvent("review", "no build info"))).toEqual([]);
  });
  it("returns empty when step mentions build success", () => {
    expect(guard.handle(makeEvent("coder", "build succeeded, all good"))).toEqual([]);
  });
  it("returns empty when step has ✅", () => {
    expect(guard.handle(makeEvent("implement", "Done ✅"))).toEqual([]);
  });
  it("returns empty when tests pass", () => {
    expect(guard.handle(makeEvent("fix-bug", "all 5 tests pass"))).toEqual([]);
  });
  it("warns when coding step lacks success indicator", () => {
    const demands = guard.handle(makeEvent("coder", "I made some changes"));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
  it("warns for implement step without verification", () => {
    const demands = guard.handle(makeEvent("implement-feature", "wrote the code"));
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });
});
