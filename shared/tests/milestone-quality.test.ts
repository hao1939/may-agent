import { describe, it, expect } from "bun:test";
import type { WorkflowGuardEvent } from "@may-agent/sdk";

// Import the guard module - milestone-quality exports `guard`
// We need to import the file to access the guard and the internal scoreMilestone
// Since scoreMilestone is not exported, we test via the guard.handle interface

// Dynamic import to handle the triple-slash reference
const { guard } = await import("../guards/milestone-quality.js");

function makeEvent(milestones: string[], step = "worker-iteration-1"): WorkflowGuardEvent {
  const milestoneText = milestones.map(m => `- [ ] ${m}`).join("\n");
  return {
    type: "step_start",
    step,
    task: `## Milestones\n${milestoneText}\n## End`,
    result: { messages: [] } as any,
    completedSteps: [],
  } as any;
}

describe("milestone-quality guard", () => {
  it("returns no demands for non-iteration-1 steps", () => {
    const demands = guard.handle(makeEvent(["Write foo.ts that passes tests"], "worker-iteration-2"));
    expect(demands).toEqual([]);
  });

  it("returns no demands when no milestone section exists", () => {
    const event = {
      type: "step_start",
      step: "worker-iteration-1",
      task: "Just do stuff",
      result: { messages: [] },
      completedSteps: [],
    } as any;
    expect(guard.handle(event)).toEqual([]);
  });

  it("returns no demands for high-quality milestones", () => {
    const demands = guard.handle(makeEvent([
      "Write `config.ts` — create the configuration file that passes all 5 tests",
      "Build report.md document that shows ≥80% coverage metric",
    ]));
    expect(demands).toEqual([]);
  });

  it("flags vague milestones with no deliverable or criteria", () => {
    const demands = guard.handle(makeEvent([
      "Understand the system",
      "Make things better",
    ]));
    expect(demands.length).toBe(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("low specificity");
  });

  it("flags research milestones without artifacts", () => {
    const demands = guard.handle(makeEvent([
      "Investigate performance bottlenecks",
    ]));
    expect(demands.length).toBe(1);
    expect(demands[0].reason).toContain("Vague milestones");
  });

  it("passes research milestones that produce artifacts", () => {
    const demands = guard.handle(makeEvent([
      "Investigate performance and write report.md documenting findings",
    ]));
    // Should score well: has deliverable (.md), has verb+criteria, bounded, research+artifact
    expect(demands).toEqual([]);
  });

  it("flags milestones with unbounded scope", () => {
    const demands = guard.handle(makeEvent([
      "Complete entire system refactor of everything",
    ]));
    expect(demands.length).toBe(1);
    expect(demands[0].reason).toContain("Vague milestones");
  });

  it("returns empty for empty milestone list", () => {
    const event = {
      type: "step_start",
      step: "worker-iteration-1",
      task: "## Milestones\n\n## End",
      result: { messages: [] },
      completedSteps: [],
    } as any;
    expect(guard.handle(event)).toEqual([]);
  });

  it("has correct name and events", () => {
    expect(guard.name).toBe("milestone-quality");
    expect(guard.events).toContain("step_start");
  });
});
