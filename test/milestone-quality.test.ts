import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/milestone-quality.js";

describe("milestone-quality guard", () => {
  const makeEvent = (step: string, task: string): any => ({
    type: "step_start",
    step,
    task,
    source: "agent",
  });

  it("returns empty for non-worker-iteration-1 steps", () => {
    expect(guard.handle(makeEvent("worker-iteration-2", ""))).toEqual([]);
    expect(guard.handle(makeEvent("review", ""))).toEqual([]);
  });
  it("returns empty when no milestones section", () => {
    expect(guard.handle(makeEvent("worker-iteration-1", "just a task"))).toEqual([]);
  });
  it("returns empty for high-quality milestones", () => {
    const task = `## Milestones
- [x] Create \`config.ts\` with 3+ exported settings that pass type-check
- [ ] Write \`test/config.test.ts\` with 5+ tests that all pass`;
    expect(guard.handle(makeEvent("worker-iteration-1", task))).toEqual([]);
  });
  it("warns on vague milestones", () => {
    const task = `## Milestones
- [ ] Investigate the full system
- [ ] Understand everything`;
    const demands = guard.handle(makeEvent("worker-iteration-1", task));
    expect(demands.length).toBeGreaterThan(0);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("specificity");
  });
  it("flags research milestones without artifacts", () => {
    const task = `## Milestones
- [ ] Investigate the logging system`;
    const demands = guard.handle(makeEvent("worker-iteration-1", task));
    expect(demands.length).toBeGreaterThan(0);
    expect(demands[0].reason).toContain("Vague milestones");
  });
});
