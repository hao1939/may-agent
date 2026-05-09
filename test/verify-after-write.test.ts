import { describe, it, expect } from "vitest";
import { guard } from "../shared/guards/verify-after-write.js";

describe("verify-after-write guard", () => {
  it("exports guard with correct name", () => {
    expect(guard.name).toBe("verify-after-write");
    expect(guard.events).toContain("step_done");
  });

  it("returns empty for non-step_done events", () => {
    expect(guard.handle({ type: "workflow_start" } as any)).toEqual([]);
  });

  it("returns empty for function source", () => {
    const event = {
      type: "step_done",
      source: "function",
      step: "build",
      result: { messages: [], finishResult: null },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns empty when no finish result", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "edit", arguments: { path: "src/a.ts" } }] },
        ],
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("blocks finish(success) when edits are unverified", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "edit", arguments: { path: "src/a.ts" } }] },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("src/a.ts");
  });

  it("blocks finish(success) for unverified writes", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "write", arguments: { path: "src/a.ts" } }] },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    const demands = guard.handle(event as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });

  it("allows finish(success) when all edits are verified by read", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "edit", arguments: { path: "src/a.ts" } },
              { type: "toolCall", name: "read", arguments: { path: "src/a.ts" } },
            ],
          },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("tracks verification across multiple steps", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "verify",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "read", arguments: { path: "src/a.ts" } }] },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [
        {
          result: {
            messages: [
              { content: [{ type: "toolCall", name: "edit", arguments: { path: "src/a.ts" } }] },
            ],
          },
        },
      ],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("normalizes paths (strips leading ./)", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "edit", arguments: { path: "./src/a.ts" } },
              { type: "toolCall", name: "read", arguments: { path: "src/a.ts" } },
            ],
          },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("normalizes /app absolute paths to project-relative paths", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "toolCall", name: "write", arguments: { path: "/app/agents/may/workspace/heartbeat-log.md" } },
              { type: "toolCall", name: "read", arguments: { path: "agents/may/workspace/heartbeat-log.md" } },
            ],
          },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("normalizes /app absolute paths across completed steps", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "finish",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "read", arguments: { path: "/app/agents/may/workspace/heartbeat-log.md" } }] },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [
        {
          result: {
            messages: [
              { content: [{ type: "toolCall", name: "write", arguments: { path: "agents/may/workspace/heartbeat-log.md" } }] },
            ],
          },
        },
      ],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("does not block non-success finish", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          { content: [{ type: "toolCall", name: "edit", arguments: { path: "src/a.ts" } }] },
        ],
        finishResult: { status: "failure" },
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("handles tool_use type in addition to toolCall", () => {
    const event = {
      type: "step_done",
      source: "agent",
      step: "implement",
      result: {
        messages: [
          {
            content: [
              { type: "tool_use", name: "edit", input: { path: "src/c.ts" } },
              { type: "tool_use", name: "read", input: { path: "src/c.ts" } },
            ],
          },
        ],
        finishResult: { status: "success" },
      },
      completedSteps: [],
    };
    expect(guard.handle(event as any)).toEqual([]);
  });
});
