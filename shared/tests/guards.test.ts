import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// We'll import the guard modules directly
// Since they export `guard: WorkflowGuard`, we test the handle() function

// Helper to create a step_done event with tool calls in messages
function makeStepDoneEvent(toolCalls: Array<{ name: string; input: Record<string, any> }>, opts?: { source?: string; lastAssistantText?: string; finishResult?: any; completedSteps?: any[] }): any {
  const content = toolCalls.map(tc => ({
    type: "tool_use",
    name: tc.name,
    input: tc.input,
  }));
  return {
    type: "step_done",
    step: "test-step",
    source: opts?.source ?? "agent",
    result: {
      messages: [{ role: "assistant", content }],
      lastAssistantText: opts?.lastAssistantText ?? "",
      finishResult: opts?.finishResult,
    },
    completedSteps: opts?.completedSteps ?? [],
  };
}

// ===== hallucinated-path guard =====
describe("hallucinated-path guard", () => {
  let guard: any;

  beforeAll(async () => {
    const mod = await import("../guards/hallucinated-path.ts");
    guard = mod.guard;
  });

  it("has correct name and events", () => {
    expect(guard.name).toBe("hallucinated-path");
    expect(guard.events).toContain("step_done");
  });

  it("returns empty for clean commands", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "ls /app/src" } }]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("detects /home/user paths", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "cat /home/user/file.txt" } }]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("Hallucinated Path");
  });

  it("detects /Users/name paths", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "ls /Users/dev/project" } }]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });

  it("detects /root/ paths", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "cat /root/.bashrc" } }]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
  });

  it("allows grep searching for /home/", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "grep -r /home/user src/" } }]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("allows echo with /home/", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "echo \"path is /home/user\"" } }]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("skips function source events", () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "cat /home/user/x" } }], { source: "function" });
    expect(guard.handle(event)).toEqual([]);
  });

  it("deduplicates violations", () => {
    const event = makeStepDoneEvent([
      { name: "bash", input: { command: "cat /home/user/a && cat /home/user/b" } },
    ]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    // Should contain /home/user only once in reason
  });

  it("returns empty for non step_done events", () => {
    const event = { type: "other", result: { messages: [] } };
    expect(guard.handle(event)).toEqual([]);
  });
});

// ===== read-before-edit guard =====
describe("read-before-edit guard", () => {
  let guard: any;

  beforeAll(async () => {
    const mod = await import("../guards/read-before-edit.ts");
    guard = mod.guard;
  });

  it("has correct name", () => {
    expect(guard.name).toBe("read-before-edit");
  });

  it("returns empty when edit has prior read", () => {
    const event = makeStepDoneEvent([
      { name: "read", input: { path: "src/app.ts" } },
      { name: "edit", input: { path: "src/app.ts" } },
    ]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("warns when edit without prior read", () => {
    const event = makeStepDoneEvent([
      { name: "edit", input: { path: "src/app.ts" } },
    ]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("C1.1");
    expect(demands[0].reason).toContain("src/app.ts");
  });

  it("normalizes paths with leading ./", () => {
    const event = makeStepDoneEvent([
      { name: "read", input: { path: "./src/app.ts" } },
      { name: "edit", input: { path: "src/app.ts" } },
    ]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("detects multiple violations", () => {
    const event = makeStepDoneEvent([
      { name: "edit", input: { path: "a.ts" } },
      { name: "edit", input: { path: "b.ts" } },
    ]);
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("2 file(s)");
  });

  it("skips function source", () => {
    const event = makeStepDoneEvent([{ name: "edit", input: { path: "x.ts" } }], { source: "function" });
    expect(guard.handle(event)).toEqual([]);
  });
});

// ===== no-secret-leak guard =====
describe("no-secret-leak guard", () => {
  let guard: any;

  beforeAll(async () => {
    const mod = await import("../guards/no-secret-leak.ts");
    guard = mod.guard;
  });

  it("has correct name", () => {
    expect(guard.name).toBe("no-secret-leak");
  });

  it("returns empty for clean text", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "Hello world, no secrets here." });
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks on Anthropic API key", () => {
    const fakeKey = "sk-ant-" + "a".repeat(50);
    const event = makeStepDoneEvent([], { lastAssistantText: `Found key: ${fakeKey}` });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("Secret leak");
  });

  it("blocks on AWS access key", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "Key is AKIAIOSFODNN7EXAMPLE" });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("AWS");
  });

  it("blocks on GitHub PAT", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "ghp_" + "a".repeat(36) });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });

  it("blocks on private key", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "-----BEGIN RSA PRIVATE KEY-----" });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });

  it("warns on Bearer token", () => {
    const token = "A".repeat(40);
    const event = makeStepDoneEvent([], { lastAssistantText: `Authorization: Bearer ${token}` });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });

  it("warns on generic API key assignment", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: `api_key = "abcdefghijklmnopqrstuvwxyz"` });
    const demands = guard.handle(event);
    expect(demands.length).toBeGreaterThanOrEqual(1);
    expect(demands[0].type).toBe("warn");
  });

  it("warns on Slack token", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "xoxb-1234567890-abcdef" });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
  });

  it("returns empty for empty lastAssistantText", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "" });
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks take priority over warns", () => {
    const fakeKey = "sk-ant-" + "a".repeat(50);
    const event = makeStepDoneEvent([], { lastAssistantText: `${fakeKey} and xoxb-1234567890-abcdef` });
    const demands = guard.handle(event);
    // Should only have block demands, no warns
    expect(demands.every((d: any) => d.type === "block")).toBe(true);
  });

  it("blocks on Stripe key", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "sk_live_" + "a".repeat(30) });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });

  it("blocks on OpenAI proj key", () => {
    const event = makeStepDoneEvent([], { lastAssistantText: "sk-proj-" + "a".repeat(50) });
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
  });
});

// ===== verify-after-write guard =====
describe("verify-after-write guard", () => {
  let guard: any;

  beforeAll(async () => {
    const mod = await import("../guards/verify-after-write.ts");
    guard = mod.guard;
  });

  it("has correct name", () => {
    expect(guard.name).toBe("verify-after-write");
  });

  it("returns empty when write is followed by read", () => {
    const event = makeStepDoneEvent([
      { name: "write", input: { path: "out.ts" } },
      { name: "read", input: { path: "out.ts" } },
    ]);
    expect(guard.handle(event)).toEqual([]);
  });

  it("returns empty for non-finish steps (no mid-step enforcement)", () => {
    const event = makeStepDoneEvent([
      { name: "write", input: { path: "out.ts" } },
    ]);
    // No finishResult, so tier 1 doesn't apply; tier 3 is disabled
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks finish(success) with unverified write", () => {
    const event = makeStepDoneEvent(
      [{ name: "write", input: { path: "out.ts" } }],
      { finishResult: { status: "success" } }
    );
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("out.ts");
  });

  it("allows finish(success) when all writes verified", () => {
    const event = makeStepDoneEvent(
      [
        { name: "write", input: { path: "out.ts" } },
        { name: "read", input: { path: "out.ts" } },
      ],
      { finishResult: { status: "success" } }
    );
    expect(guard.handle(event)).toEqual([]);
  });

  it("counts reads from completed steps as verification", () => {
    const completedSteps = [{
      result: {
        messages: [{
          role: "assistant",
          content: [{ type: "tool_use", name: "write", input: { path: "a.ts" } }],
        }],
      },
    }];
    // Current step reads the file written in previous step
    const event = makeStepDoneEvent(
      [{ name: "read", input: { path: "a.ts" } }],
      { finishResult: { status: "success" }, completedSteps }
    );
    expect(guard.handle(event)).toEqual([]);
  });

  it("blocks finish with multiple unverified files", () => {
    const event = makeStepDoneEvent(
      [
        { name: "write", input: { path: "a.ts" } },
        { name: "edit", input: { path: "b.ts" } },
      ],
      { finishResult: { status: "success" } }
    );
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("a.ts");
    expect(demands[0].reason).toContain("b.ts");
  });

  it("does not block finish(failure)", () => {
    const event = makeStepDoneEvent(
      [{ name: "write", input: { path: "out.ts" } }],
      { finishResult: { status: "failure" } }
    );
    expect(guard.handle(event)).toEqual([]);
  });

  it("skips function source", () => {
    const event = makeStepDoneEvent(
      [{ name: "write", input: { path: "out.ts" } }],
      { source: "function", finishResult: { status: "success" } }
    );
    expect(guard.handle(event)).toEqual([]);
  });

  it("normalizes paths", () => {
    const event = makeStepDoneEvent(
      [
        { name: "write", input: { path: "./src/app.ts" } },
        { name: "read", input: { path: "src/app.ts" } },
      ],
      { finishResult: { status: "success" } }
    );
    expect(guard.handle(event)).toEqual([]);
  });
});

// ===== loader =====
describe("guard loader", () => {
  let loadGuards: any;
  let runGuards: any;
  let clearGuardCache: any;

  beforeAll(async () => {
    const mod = await import("../guards/loader.ts");
    loadGuards = mod.loadGuards;
    runGuards = mod.runGuards;
    clearGuardCache = mod.clearGuardCache;
  });

  beforeEach(() => {
    clearGuardCache();
  });

  it("loads all guards", async () => {
    const guards = await loadGuards();
    expect(guards.length).toBeGreaterThanOrEqual(4);
    const names = guards.map((g: any) => g.name);
    expect(names).toContain("hallucinated-path");
    expect(names).toContain("read-before-edit");
    expect(names).toContain("no-secret-leak");
    expect(names).toContain("verify-after-write");
  });

  it("caches results", async () => {
    const g1 = await loadGuards();
    const g2 = await loadGuards();
    expect(g1).toBe(g2);
  });

  it("clearGuardCache resets cache", async () => {
    const g1 = await loadGuards();
    clearGuardCache();
    const g2 = await loadGuards();
    expect(g1).not.toBe(g2);
  });

  it("runGuards aggregates demands", async () => {
    const event = makeStepDoneEvent([{ name: "bash", input: { command: "cat /home/user/x" } }]);
    const demands = await runGuards(event);
    expect(demands.length).toBeGreaterThanOrEqual(1);
  });

  it("runGuards skips guards not listening for event type", async () => {
    const event = { type: "workflow_start", result: { messages: [] } };
    const demands = await runGuards(event);
    expect(demands).toEqual([]);
  });
});
