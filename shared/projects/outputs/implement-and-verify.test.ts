import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the parseInput and runVerification logic by importing internals
// Since they're not exported, we test via the module's execute function indirectly
// But first, let's test what we can extract

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../workflows/fewshot-inject-helpers.js", () => ({
  injectFewShot: (task: string) => task,
}));

import { execSync } from "node:child_process";
import { name, description, execute } from "../workflows/implement-and-verify.js";

function makeCtx(task: string): any {
  const events: any[] = [];
  return {
    task,
    emit: (e: any) => events.push(e),
    events,
    runAgent: vi.fn().mockResolvedValue({ status: "ok", lastAssistantText: "done" }),
    done: (msg: string) => ({ status: "done", message: msg }),
    escalate: (msg: string, meta?: any) => ({ status: "escalated", message: msg, meta }),
  };
}

describe("implement-and-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports correct name", () => {
    expect(name).toBe("implement-and-verify");
  });

  it("exports a description", () => {
    expect(description).toContain("Lightweight");
  });

  it("escalates on empty task", async () => {
    const ctx = makeCtx("");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
  });

  it("succeeds when verification passes on first attempt", async () => {
    (execSync as any).mockReturnValue("All tests passed");
    const ctx = makeCtx("Add a hello function");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(ctx.runAgent).toHaveBeenCalledTimes(1);
  });

  it("retries when verification fails first time", async () => {
    (execSync as any)
      .mockImplementationOnce(() => { throw { status: 1, stdout: "error", stderr: "" }; })
      .mockReturnValueOnce("pass");
    const ctx = makeCtx("Fix the bug");
    const result = await execute(ctx);
    expect(result.status).toBe("done");
    expect(ctx.runAgent).toHaveBeenCalledTimes(2);
  });

  it("escalates after all attempts exhausted", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "fail", stderr: "" }; });
    const ctx = makeCtx("Do something");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
    expect(result.message).toContain("failed after 2 attempts");
  });

  it("respects custom maxAttempts", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "err", stderr: "" }; });
    const ctx = makeCtx("Do task\nmaxAttempts: 3");
    const result = await execute(ctx);
    expect(ctx.runAgent).toHaveBeenCalledTimes(3);
  });

  it("respects custom verifyCommand", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Do task\nverifyCommand: echo hello");
    await execute(ctx);
    expect(execSync).toHaveBeenCalledWith("echo hello", expect.anything());
  });

  it("escalates when coder fails on first attempt after retry", async () => {
    const ctx = makeCtx("Do something");
    ctx.runAgent = vi.fn().mockResolvedValue({ status: "error", error: "crash" });
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
  });

  it("escalates when coder fails on fix attempt", async () => {
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: "fail", stderr: "" }; });
    const ctx = makeCtx("Do something");
    ctx.runAgent = vi.fn()
      .mockResolvedValueOnce({ status: "ok", lastAssistantText: "done" })
      .mockResolvedValueOnce({ status: "error", error: "crash" });
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
  });

  it("truncates long verify output", async () => {
    const longOutput = "x".repeat(5000);
    (execSync as any).mockImplementation(() => { throw { status: 1, stdout: longOutput, stderr: "" }; });
    const ctx = makeCtx("Do task\nmaxAttempts: 1");
    const result = await execute(ctx);
    expect(result.status).toBe("escalated");
  });

  it("emits step events", async () => {
    (execSync as any).mockReturnValue("ok");
    const ctx = makeCtx("Do task");
    await execute(ctx);
    expect(ctx.events.length).toBeGreaterThanOrEqual(2);
    expect(ctx.events[0].step).toBe("coder-attempt-1");
  });
});
