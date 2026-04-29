import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/auto-test.js";

describe("auto-test guard", () => {
  it("exports guard with correct name", () => {
    expect(guard.name).toBe("auto-test");
    expect(guard.events).toContain("step_done");
  });

  it("returns empty array for non-step_done events", () => {
    const result = guard.handle({ type: "workflow_start" } as any);
    expect(result).toEqual([]);
  });

  it("returns empty array for function source", () => {
    const event = {
      type: "step_done",
      source: "function",
      step: "build",
      result: { messages: [], lastAssistantText: "" },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns empty array for guard-injected steps", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "guard:auto-test",
      result: { messages: [], lastAssistantText: "" },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns empty array when no src/ files are modified", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "docs/readme.md" } },
            ],
          },
        ],
        lastAssistantText: "",
      },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns warn when src/ .ts files modified without test confirmation", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "src/lib/utils.ts" } },
            ],
          },
        ],
        lastAssistantText: "I wrote the utility function.",
      },
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("src/lib/utils.ts");
  });

  it("returns empty array when tests are confirmed in output", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "src/lib/utils.ts" } },
            ],
          },
        ],
        lastAssistantText: "All 12 tests pass successfully.",
      },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns empty array when '5 pass 0 fail' pattern found", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "edit", arguments: { path: "src/app.ts" } },
            ],
          },
        ],
        lastAssistantText: "Results: 5 pass 0 fail",
      },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("detects files from 'Wrote N bytes to' text pattern", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "text", text: "Wrote 1234 bytes to src/index.ts" },
            ],
          },
        ],
        lastAssistantText: "Done writing.",
      },
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("src/index.ts");
  });

  it("detects files from finishResult deliverables", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [{ content: [] }],
        lastAssistantText: "",
        finishResult: {
          deliverables: [{ path: "src/feature.ts" }],
        },
      },
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("src/feature.ts");
  });

  it("ignores non-.ts/.js files in src/", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "src/data.json" } },
            ],
          },
        ],
        lastAssistantText: "",
      },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("counts multiple modified src files", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "src/a.ts" } },
              { type: "toolCall", name: "edit", arguments: { path: "src/b.js" } },
            ],
          },
        ],
        lastAssistantText: "Updated both files.",
      },
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("2 source file(s)");
  });
});
