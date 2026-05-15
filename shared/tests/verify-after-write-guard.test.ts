import { describe, it, expect } from "bun:test";

// Import the guard module
const guardModule = await import("../guards/verify-after-write.ts");
const guard = guardModule.guard;

function makeEvent(overrides: any = {}): any {
  return {
    type: "step_done",
    source: "agent",
    completedSteps: [],
    result: { messages: [], ...overrides.result },
    ...overrides,
  };
}

function toolCallMsg(calls: Array<{ id?: string; name: string; path?: string }>): any {
  return {
    role: "assistant",
    content: calls.map((c, i) => ({
      type: "toolCall",
      id: c.id ?? `call-${i}`,
      name: c.name,
      arguments: { path: c.path },
    })),
  };
}

function toolErrorMsg(toolCallId: string): any {
  return {
    role: "toolResult",
    toolCallId,
    isError: true,
    content: [{ type: "text", text: "EACCES: permission denied" }],
  };
}

describe("verify-after-write guard", () => {
  it("has correct name and events", () => {
    expect(guard.name).toBe("verify-after-write");
    expect(guard.events).toContain("step_done");
  });

  it("returns empty for non-step_done events", () => {
    const result = guard.handle({ ...makeEvent(), type: "workflow_start" });
    expect(result).toEqual([]);
  });

  it("returns empty for function source", () => {
    const result = guard.handle({ ...makeEvent(), source: "function" });
    expect(result).toEqual([]);
  });

  it("returns empty when no writes", () => {
    const event = makeEvent({
      result: {
        messages: [toolCallMsg([{ name: "read", path: "foo.ts" }])],
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("returns empty when edit is followed by read", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([
            { name: "edit", path: "foo.ts" },
            { name: "read", path: "foo.ts" },
          ]),
        ],
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("returns empty for non-finish steps even with unverified edits", () => {
    const event = makeEvent({
      result: {
        messages: [toolCallMsg([{ name: "edit", path: "foo.ts" }])],
      },
    });
    // No finishResult → tier 3 is disabled, so no demands
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks finish(success) when edits are unverified", () => {
    const event = makeEvent({
      result: {
        messages: [toolCallMsg([{ name: "edit", path: "foo.ts" }])],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("C1.3 Verify-After-Write");
    expect(demands[0].reason).toContain("foo.ts");
  });

  it("does not require read-back for failed write attempts", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([{ id: "failed-write", name: "write", path: "research/out.md" }]),
          toolErrorMsg("failed-write"),
        ],
        finishResult: { status: "success" },
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("still requires read-back for a successful write after an earlier failed write", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([{ id: "failed-write", name: "write", path: "research/out.md" }]),
          toolErrorMsg("failed-write"),
          toolCallMsg([{ id: "successful-write", name: "write", path: "agents/out.md" }]),
        ],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("agents/out.md");
    expect(demands[0].reason).not.toContain("research/out.md");
  });

  it("blocks finish(success) with multiple unverified files", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([
            { name: "edit", path: "a.ts" },
            { name: "edit", path: "b.ts" },
          ]),
        ],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("2 file(s)");
  });

  it("allows finish(success) when all edits are verified", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([
            { name: "edit", path: "foo.ts" },
            { name: "read", path: "foo.ts" },
          ]),
        ],
        finishResult: { status: "success" },
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("tracks edits across completed steps", () => {
    const event = makeEvent({
      completedSteps: [
        { result: { messages: [toolCallMsg([{ name: "edit", path: "old.ts" }])] } },
      ],
      result: {
        messages: [toolCallMsg([{ name: "edit", path: "new.ts" }])],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("2 file(s)");
  });

  it("read in later step counts as verification", () => {
    const event = makeEvent({
      completedSteps: [
        { result: { messages: [toolCallMsg([{ name: "edit", path: "a.ts" }])] } },
      ],
      result: {
        messages: [toolCallMsg([{ name: "read", path: "a.ts" }])],
        finishResult: { status: "success" },
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("normalizes paths with leading ./", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([
            { name: "edit", path: "./foo.ts" },
            { name: "read", path: "foo.ts" },
          ]),
        ],
        finishResult: { status: "success" },
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles edit calls", () => {
    const event = makeEvent({
      result: {
        messages: [toolCallMsg([{ name: "edit", path: "bar.ts" }])],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("bar.ts");
  });

  it("does not block non-success finish", () => {
    const event = makeEvent({
      result: {
        messages: [toolCallMsg([{ name: "edit", path: "foo.ts" }])],
        finishResult: { status: "failure" },
      },
    });
    // finishResult.status !== "success", so no block
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles empty messages", () => {
    const event = makeEvent({
      result: { messages: [], finishResult: { status: "success" } },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("handles tool_use type content parts", () => {
    const event = makeEvent({
      result: {
        messages: [{
          role: "assistant",
          content: [{
            type: "tool_use",
            name: "edit",
            input: { path: "x.ts" },
          }],
        }],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("x.ts");
  });

  it("handles messages without content array", () => {
    const event = makeEvent({
      result: {
        messages: [{ role: "user", content: "hello" }],
        finishResult: { status: "success" },
      },
    });
    expect(guard.handle(event)).toEqual([]);
  });

  it("read before edit does not count as verification", () => {
    const event = makeEvent({
      result: {
        messages: [
          toolCallMsg([
            { name: "read", path: "foo.ts" },
            { name: "edit", path: "foo.ts" },
          ]),
        ],
        finishResult: { status: "success" },
      },
    });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
  });

  it("allows finish when absolute-path writes and edits are read back in later completed steps", () => {
    const event = makeEvent({
      completedSteps: [
        {
          result: {
            messages: [toolCallMsg([
              { id: "write-findings", name: "write", path: "/app/projects/aks-rp-e2e/outputs/underlay-debug-findings.md" },
            ])],
          },
        },
        {
          result: {
            messages: [toolCallMsg([
              { id: "edit-summary", name: "edit", path: "/app/projects/aks-rp-e2e/outputs/e2e-run-results-summary.md" },
            ])],
          },
        },
        {
          result: {
            messages: [toolCallMsg([
              { id: "read-findings", name: "read", path: "/app/projects/aks-rp-e2e/outputs/underlay-debug-findings.md" },
              { id: "read-summary", name: "read", path: "/app/projects/aks-rp-e2e/outputs/e2e-run-results-summary.md" },
            ])],
          },
        },
      ],
      result: {
        messages: [],
        finishResult: { status: "success" },
      },
    });

    expect(guard.handle(event)).toEqual([]);
  });

  it("ignores failed edit calls with missing path so they do not create unknown-path obligations", () => {
    const event = makeEvent({
      completedSteps: [
        {
          result: {
            messages: [
              {
                role: "assistant",
                content: [{ type: "toolCall", id: "bad-edit", name: "edit", arguments: {} }],
              },
              toolErrorMsg("bad-edit"),
              toolCallMsg([{ id: "good-edit", name: "edit", path: "/app/projects/aks-rp-e2e/outputs/e2e-run-results-summary.md" }]),
            ],
          },
        },
        {
          result: {
            messages: [toolCallMsg([{ id: "read-summary", name: "read", path: "projects/aks-rp-e2e/outputs/e2e-run-results-summary.md" }])],
          },
        },
      ],
      result: {
        messages: [],
        finishResult: { status: "success" },
      },
    });

    expect(guard.handle(event)).toEqual([]);
  });
});
