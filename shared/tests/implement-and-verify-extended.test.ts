import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../workflows/fewshot-inject-helpers.js", () => ({
  injectFewShot: (task: string) => `[fewshot]${task}`,
}));

import { execSync } from "node:child_process";
import { name, description, execute } from "../workflows/implement-and-verify.js";

function makeCtx(task: string, overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  return {
    task,
    emit: (e: any) => events.push(e),
    events,
    runAgent: vi.fn().mockResolvedValue({ status: "ok", lastAssistantText: "implemented" }),
    done: (msg: string) => ({ status: "done", message: msg }),
    escalate: (msg: string, meta?: any) => ({ status: "escalated", message: msg, meta }),
    ...overrides,
  };
}

describe("implement-and-verify extended", () => {
  beforeEach(() => vi.clearAllMocks());

  // --- parseInput edge cases ---
  
  it("handles task with only whitespace after stripping metadata", async () => {
    const ctx = makeCtx("verifyCommand: echo hi\nmaxAttempts: 1\n   ");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
  });

  it("handles task with verifyCommand and maxAttempts together", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Build feature X\nverifyCommand: npm test\nmaxAttempts: 1");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(execSync).toHaveBeenCalledWith("npm test", expect.anything());
    expect(ctx.runAgent).toHaveBeenCalledTimes(1);
  });

  it("uses default verify command when none specified", async () => {
    (execSync as any).mockReturnValue("pass");
    const ctx = makeCtx("Simple task");
    await execute(ctx);
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("tsc --noEmit"),
      expect.anything()
    );
  });

  it("strips metadata lines from task text", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Build X\nverifyCommand: echo ok\nmaxAttempts: 1");
    await execute(ctx);
    const calledTask = ctx.runAgent.mock.calls[0][1];
    expect(calledTask).not.toContain("verifyCommand:");
    expect(calledTask).not.toContain("maxAttempts:");
    expect(calledTask).toContain("Build X");
  });

  // --- fewshot injection ---

  it("injects fewshot on first attempt", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("My coding task");
    await execute(ctx);
    const calledTask = ctx.runAgent.mock.calls[0][1];
    expect(calledTask).toContain("[fewshot]");
  });

  it("does not inject fewshot on retry attempts", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "err", stderr: "" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    await execute(ctx);
    const retryTask = ctx.runAgent.mock.calls[1][1];
    expect(retryTask).not.toContain("[fewshot]");
    expect(retryTask).toContain("Fix Required");
  });

  // --- verification behavior ---

  it("passes verification output in done message", async () => {
    (execSync as any).mockReturnValue("All 50 tests passed");
    const ctx = makeCtx("Add tests");
    const result = await execute(ctx);
    expect(result.message).toContain("All 50 tests passed");
    expect(result.message).toContain("PASSED");
  });

  it("handles execSync returning empty string", async () => {
    (execSync as any).mockReturnValue("");
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(result.message).toContain("(no output)");
  });

  it("handles error with no stdout/stderr", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1 }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
  });

  it("truncates long error output to 3000 chars", async () => {
    const longErr = "x".repeat(5000);
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: longErr, stderr: "" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    await execute(ctx);
    const retryTask = ctx.runAgent.mock.calls[1][1];
    expect(retryTask).toContain("(truncated)");
  });

  it("combines stdout and stderr in error output", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "OUT", stderr: "ERR" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    await execute(ctx);
    const retryTask = ctx.runAgent.mock.calls[1][1];
    expect(retryTask).toContain("OUT");
    expect(retryTask).toContain("ERR");
  });

  // --- coder error handling ---

  it("retries coder once on first attempt error", async () => {
    const ctx = makeCtx("Task");
    ctx.runAgent = vi.fn()
      .mockResolvedValueOnce({ status: "error", error: "timeout" })
      .mockResolvedValueOnce({ status: "ok", lastAssistantText: "fixed" });
    (execSync as any).mockReturnValue("ok");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(ctx.runAgent).toHaveBeenCalledTimes(2);
  });

  it("escalates if coder fails both tries on first attempt", async () => {
    const ctx = makeCtx("Task");
    ctx.runAgent = vi.fn().mockResolvedValue({ status: "error", error: "crash" });
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
    expect(result.message).toContain("retry");
  });

  it("escalates if coder fails on second attempt (no retry)", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "fail", stderr: "" }; });
    const ctx = makeCtx("Task");
    ctx.runAgent = vi.fn()
      .mockResolvedValueOnce({ status: "ok", lastAssistantText: "v1" })
      .mockResolvedValueOnce({ status: "error", error: "crash" });
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
    expect(result.message).toContain("fix attempt");
  });

  it("includes coder text in done message", async () => {
    (execSync as any).mockReturnValue("pass");
    const ctx = makeCtx("Task");
    ctx.runAgent = vi.fn().mockResolvedValue({ status: "ok", lastAssistantText: "Created foo.ts" });
    const result = await execute(ctx);
    expect(result.message).toContain("Created foo.ts");
  });

  it("handles missing lastAssistantText", async () => {
    (execSync as any).mockReturnValue("pass");
    const ctx = makeCtx("Task");
    ctx.runAgent = vi.fn().mockResolvedValue({ status: "ok" });
    const result = await execute(ctx);
    expect(result.message).toContain("(no output)");
  });

  // --- maxAttempts variations ---

  it("maxAttempts: 1 means no retry on verify fail", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "err", stderr: "" }; });
    const ctx = makeCtx("Task\nmaxAttempts: 1");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
    expect(ctx.runAgent).toHaveBeenCalledTimes(1);
  });

  it("maxAttempts: 4 allows 4 attempts", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "err", stderr: "" }; });
    const ctx = makeCtx("Task\nmaxAttempts: 4");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
    expect(ctx.runAgent).toHaveBeenCalledTimes(4);
  });

  it("succeeds on third attempt out of four", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "e1", stderr: "" }; })
      .mockImplementationOnce(() => { throw { status: 1, stdout: "e2", stderr: "" }; })
      .mockReturnValueOnce("pass");
    const ctx = makeCtx("Task\nmaxAttempts: 4");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(ctx.runAgent).toHaveBeenCalledTimes(3);
  });

  // --- event emission ---

  it("emits coder and verify events for each attempt", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "e", stderr: "" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    await execute(ctx);
    expect(ctx.events).toEqual([
      { type: "step_start", step: "coder-attempt-1" },
      { type: "step_start", step: "verify-attempt-1" },
      { type: "step_start", step: "coder-attempt-2" },
      { type: "step_start", step: "verify-attempt-2" },
    ]);
  });

  // --- done message content ---

  it("done message contains verification command", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Task\nverifyCommand: make test");
    const result = await execute(ctx);
    expect(result.message).toContain("make test");
  });

  it("done message contains CALLER warning", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    expect(result.message).toContain("CALLER: Verify intent yourself");
  });

  it("done message truncates long verify output to 2000 chars", async () => {
    (execSync as any).mockReturnValue("y".repeat(3000));
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    // The message slices verify output to 2000 chars
    expect(result.message.length).toBeLessThan(5000);
  });

  // --- escalate metadata ---

  it("escalate includes verifyCommand and lastOutput", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "bad", stderr: "" }; });
    const ctx = makeCtx("Task\nverifyCommand: npm run check");
    const result = await execute(ctx);
    expect(result.meta.verifyCommand).toBe("npm run check");
    expect(result.meta.lastOutput).toContain("bad");
  });

  it("retry prompt includes original task and error", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "TypeError: x", stderr: "" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Build the widget");
    await execute(ctx);
    const retryTask = ctx.runAgent.mock.calls[1][1];
    expect(retryTask).toContain("Build the widget");
    expect(retryTask).toContain("TypeError: x");
    expect(retryTask).toContain("FAILED");
  });

  // --- error with null/undefined properties ---

  it("handles error with null status", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: null, stdout: "", stderr: "" }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
  });

  it("handles error with undefined stdout/stderr", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1 }; })
      .mockReturnValueOnce("ok");
    const ctx = makeCtx("Task");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
  });
});
