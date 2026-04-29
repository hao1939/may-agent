import { describe, it, expect } from "vitest";
import { guard as buildCheck } from "../guards/build-check.ts";
import { guard as costLimit } from "../guards/cost-limit.ts";
import { guard as rbePrimer } from "../guards/rbe-primer.ts";
import { guard as vaePrimer } from "../guards/vae-primer.ts";

// ── build-check guard ───────────────────────────────────────────────────

describe("build-check guard", () => {
  it("has correct name and events", () => {
    expect(buildCheck.name).toBe("build-check");
    expect(buildCheck.events).toContain("step_done");
  });

  it("returns empty for non-step_done events", () => {
    const result = buildCheck.handle({ type: "step_start", source: "agent", step: "coder", result: {} } as any);
    expect(result).toEqual([]);
  });

  it("returns empty for non-agent sources", () => {
    const result = buildCheck.handle({ type: "step_done", source: "function", step: "coder", result: { lastAssistantText: "" } } as any);
    expect(result).toEqual([]);
  });

  it("returns empty for non-coding steps", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "review", result: { lastAssistantText: "" } } as any);
    expect(result).toEqual([]);
  });

  it("returns empty when build success is mentioned", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "coder", result: { lastAssistantText: "build passes successfully" } } as any);
    expect(result).toEqual([]);
  });

  it("returns empty when tests pass is mentioned", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "implement", result: { lastAssistantText: "all 5 tests pass" } } as any);
    expect(result).toEqual([]);
  });

  it("returns empty when ✅ is present", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "fix", result: { lastAssistantText: "✅ Done" } } as any);
    expect(result).toEqual([]);
  });

  it("returns empty when exit code 0 mentioned", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "code", result: { lastAssistantText: "exit code 0" } } as any);
    expect(result).toEqual([]);
  });

  it("warns when no success indicator for coding step", () => {
    const result = buildCheck.handle({ type: "step_done", source: "agent", step: "coder", result: { lastAssistantText: "I made some changes" } } as any);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("warn");
    expect(result[0].reason).toContain("without build/test success");
  });
});

// ── cost-limit guard ────────────────────────────────────────────────────

describe("cost-limit guard", () => {
  it("has correct name and events", () => {
    expect(costLimit.name).toBe("cost-limit");
    expect(costLimit.events).toContain("step_done");
  });

  it("returns empty for non-step_done events", () => {
    const result = costLimit.handle({ type: "step_start" } as any);
    expect(result).toEqual([]);
  });

  it("returns empty below warn threshold", () => {
    const result = costLimit.handle({
      type: "step_done",
      completedSteps: [{ result: { turnsUsed: 10 } }],
      result: { turnsUsed: 5 },
    } as any);
    expect(result).toEqual([]);
  });

  it("warns at 40+ turns", () => {
    const result = costLimit.handle({
      type: "step_done",
      completedSteps: [{ result: { turnsUsed: 35 } }],
      result: { turnsUsed: 5 },
    } as any);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("warn");
  });

  it("blocks at 60+ turns", () => {
    const result = costLimit.handle({
      type: "step_done",
      completedSteps: [{ result: { turnsUsed: 50 } }],
      result: { turnsUsed: 10 },
    } as any);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("block");
  });

  it("handles missing completedSteps", () => {
    const result = costLimit.handle({
      type: "step_done",
      completedSteps: undefined,
      result: { turnsUsed: 5 },
    } as any);
    expect(result).toEqual([]);
  });
});

// ── rbe-primer guard ────────────────────────────────────────────────────

describe("rbe-primer guard", () => {
  it("has correct name", () => {
    expect(rbePrimer.name).toBe("rbe-primer");
  });

  it("returns empty for function source", () => {
    const result = rbePrimer.handle({ type: "step_start", source: "function" } as any);
    expect(result).toEqual([]);
  });

  it("returns warn for agent source", () => {
    const result = rbePrimer.handle({ type: "step_start", source: "agent" } as any);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("warn");
    expect(result[0].reason).toContain("read()");
  });
});

// ── vae-primer guard ────────────────────────────────────────────────────

describe("vae-primer guard", () => {
  it("has correct name", () => {
    expect(vaePrimer.name).toBe("vae-primer");
  });

  it("returns empty for function source", () => {
    const result = vaePrimer.handle({ type: "step_start", source: "function" } as any);
    expect(result).toEqual([]);
  });

  it("returns warn for agent source", () => {
    const result = vaePrimer.handle({ type: "step_start", source: "agent" } as any);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("warn");
    expect(result[0].reason).toContain("edit()");
  });
});
