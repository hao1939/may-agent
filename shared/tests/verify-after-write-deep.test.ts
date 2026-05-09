import { describe, it, expect } from "vitest";
import { guard } from "../guards/verify-after-write.ts";

// Helper to create tool call messages
function makeMsg(calls: Array<{ name: string; path?: string }>) {
  return {
    content: calls.map((c) => ({
      type: "tool_use",
      name: c.name,
      input: c.path ? { path: c.path } : {},
    })),
  };
}

function makeEvent(opts: {
  messages: any[];
  completedSteps?: any[];
  finishResult?: any;
  source?: string;
}): any {
  return {
    type: "step_done",
    source: opts.source ?? "agent",
    result: {
      messages: opts.messages,
      finishResult: opts.finishResult,
    },
    completedSteps: opts.completedSteps ?? [],
  };
}

describe("verify-after-write guard", () => {
  it("returns empty for non step_done events", () => {
    const event = { type: "step_start", source: "agent", result: { messages: [] }, completedSteps: [] };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it("returns empty for function source", () => {
    const event = makeEvent({ messages: [], source: "function" });
    expect(guard.handle(event)).toEqual([]);
  });

  it("returns empty when no finish result", () => {
    const msgs = [makeMsg([{ name: "write", path: "foo.ts" }])];
    const event = makeEvent({ messages: msgs });
    expect(guard.handle(event)).toEqual([]);
  });

  it("allows finish when writes are unverified because write returns a preview", () => {
    const msgs = [makeMsg([{ name: "write", path: "foo.ts" }])];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("allows finish when writes are followed by read", () => {
    const msgs = [
      makeMsg([
        { name: "write", path: "foo.ts" },
        { name: "read", path: "foo.ts" },
      ]),
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks when edit is unverified", () => {
    const msgs = [makeMsg([{ name: "edit", path: "bar.ts" }])];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    const demands = guard.handle(event);
    expect(demands.length).toBe(1);
    expect(demands[0].reason).toContain("bar.ts");
  });

  it("read in later step counts as verification", () => {
    const step1Msgs = [makeMsg([{ name: "write", path: "foo.ts" }])];
    const step2Msgs = [makeMsg([{ name: "read", path: "foo.ts" }])];
    const event = makeEvent({
      messages: step2Msgs,
      completedSteps: [{ result: { messages: step1Msgs } }],
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("normalizes paths with ./ prefix", () => {
    const msgs = [
      makeMsg([
        { name: "write", path: "./src/foo.ts" },
        { name: "read", path: "src/foo.ts" },
      ]),
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks with multiple unverified files", () => {
    const msgs = [
      makeMsg([
        { name: "write", path: "a.ts" },
        { name: "edit", path: "b.ts" },
      ]),
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    const demands = guard.handle(event);
    expect(demands.length).toBe(1);
    expect(demands[0].reason).toContain("b.ts");
    expect(demands[0].reason).not.toContain("a.ts");
  });

  it("does not block non-success finish", () => {
    const msgs = [makeMsg([{ name: "write", path: "foo.ts" }])];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "failure" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles messages without content array", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles tool calls without path", () => {
    const msgs = [
      {
        content: [
          { type: "tool_use", name: "bash", input: { command: "ls" } },
        ],
      },
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("read before write is allowed because writes do not require a later read", () => {
    const msgs = [
      makeMsg([
        { name: "read", path: "foo.ts" },
        { name: "write", path: "foo.ts" },
      ]),
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles toolCall type as well as tool_use", () => {
    const msgs = [
      {
        content: [
          { type: "toolCall", toolName: "write", arguments: { path: "x.ts" } },
          { type: "toolCall", toolName: "read", arguments: { path: "x.ts" } },
        ],
      },
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles double slash normalization", () => {
    const msgs = [
      makeMsg([
        { name: "write", path: "src//foo.ts" },
        { name: "read", path: "src/foo.ts" },
      ]),
    ];
    const event = makeEvent({
      messages: msgs,
      finishResult: { status: "success" },
    });
    expect(guard.handle(event)).toEqual([]);
  });
});
